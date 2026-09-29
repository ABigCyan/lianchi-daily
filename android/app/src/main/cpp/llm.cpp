// 内置大模型：用 llama.cpp 在手机上跑 GGUF 小模型（CPU，arm64 dotprod）。
// Java 端见 LocalLlmPlugin.java；所有调用都在同一个后台线程里，只有 nativeStop 会从别的线程调用。
#include <jni.h>
#include <android/log.h>
#include <atomic>
#include <string>
#include <vector>
#include <algorithm>
#include "llama.h"

#define TAG "lianchi-llm"
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)

namespace {

struct Engine {
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    const llama_vocab *vocab = nullptr;
    int n_ctx = 4096;
    std::atomic<bool> stop{false};
};

void log_cb(ggml_log_level level, const char *text, void *) {
    if (level >= GGML_LOG_LEVEL_WARN) LOGW("%s", text);
}

// Java 传字节数组（UTF-8），避免 NewStringUTF 对 emoji 等 4 字节字符出错
std::string bytes(JNIEnv *env, jbyteArray a) {
    if (!a) return "";
    const jsize n = env->GetArrayLength(a);
    std::string s(n, '\0');
    env->GetByteArrayRegion(a, 0, n, reinterpret_cast<jbyte *>(&s[0]));
    return s;
}

jbyteArray to_bytes(JNIEnv *env, const std::string &s) {
    jbyteArray a = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(a, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
    return a;
}

// 出错时返回以 \x01ERR: 开头的文字，Java 端识别后抛出
jbyteArray err(JNIEnv *env, const char *msg) { return to_bytes(env, std::string("\x01ERR:") + msg); }

// 返回 s 里可以安全输出的完整 UTF-8 前缀长度（最后一个字符可能还没生成完）
size_t utf8_complete(const std::string &s) {
    size_t i = s.size();
    int back = 0;
    while (i > 0 && back < 4) {
        const unsigned char c = (unsigned char) s[i - 1];
        if ((c & 0xC0) != 0x80) {  // 找到一个字符的起始字节
            const int need = c < 0x80 ? 1 : (c >> 5) == 0x6 ? 2 : (c >> 4) == 0xE ? 3 : (c >> 3) == 0x1E ? 4 : 1;
            return (back + 1 >= need) ? s.size() : i - 1;
        }
        --i;
        ++back;
    }
    return s.size();
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeLoad(JNIEnv *env, jclass, jstring jpath, jint n_ctx, jint threads) {
    static bool inited = false;
    if (!inited) {
        llama_log_set(log_cb, nullptr);
        llama_backend_init();
        inited = true;
    }
    const char *path = env->GetStringUTFChars(jpath, nullptr);
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    llama_model *model = llama_model_load_from_file(path, mp);
    env->ReleaseStringUTFChars(jpath, path);
    if (!model) return 0;

    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) n_ctx;
    cp.n_batch = 512;
    cp.n_ubatch = 512;
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    llama_context *ctx = llama_init_from_model(model, cp);
    if (!ctx) {
        llama_model_free(model);
        return 0;
    }
    auto *e = new Engine();
    e->model = model;
    e->ctx = ctx;
    e->vocab = llama_model_get_vocab(model);
    e->n_ctx = n_ctx;
    return reinterpret_cast<jlong>(e);
}

// 生成：messages 按 role/content 两个数组传入（UTF-8 字节）；每出一段文字回调 cb.onToken(byte[])，
// 提示词读完时回调 cb.onPrefill(int 提示词 token 数)。返回完整文字；出错时见 err()。
JNIEXPORT jbyteArray JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeGenerate(JNIEnv *env, jclass, jlong handle, jobjectArray roles,
                                                       jobjectArray contents, jint max_tokens, jfloat temp, jobject cb) {
    auto *e = reinterpret_cast<Engine *>(handle);
    if (!e) return err(env, "模型没有加载");
    e->stop = false;

    jclass cbc = env->GetObjectClass(cb);
    jmethodID onToken = env->GetMethodID(cbc, "onToken", "([B)V");
    jmethodID onPrefill = env->GetMethodID(cbc, "onPrefill", "(I)V");

    const jsize n = env->GetArrayLength(roles);
    std::vector<std::string> R(n), C(n);
    size_t total = 0;
    for (jsize i = 0; i < n; i++) {
        auto r = (jbyteArray) env->GetObjectArrayElement(roles, i);
        auto c = (jbyteArray) env->GetObjectArrayElement(contents, i);
        R[i] = bytes(env, r);
        C[i] = bytes(env, c);
        total += R[i].size() + C[i].size();
        env->DeleteLocalRef(r);
        env->DeleteLocalRef(c);
    }
    std::vector<llama_chat_message> msgs(n);
    for (jsize i = 0; i < n; i++) msgs[i] = {R[i].c_str(), C[i].c_str()};

    const char *tmpl = llama_model_chat_template(e->model, nullptr);
    std::vector<char> buf(total * 2 + 1024);
    int len = llama_chat_apply_template(tmpl, msgs.data(), msgs.size(), true, buf.data(), (int32_t) buf.size());
    if (len > (int) buf.size()) {
        buf.resize(len + 1);
        len = llama_chat_apply_template(tmpl, msgs.data(), msgs.size(), true, buf.data(), (int32_t) buf.size());
    }
    if (len < 0) return err(env, "模型的对话模板不支持");
    const std::string prompt(buf.data(), len);

    int nt = -llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
    std::vector<llama_token> toks(std::max(nt, 1));
    nt = llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(), (int32_t) toks.size(), true, true);
    if (nt <= 0) return err(env, "分词失败");
    if (nt + max_tokens > e->n_ctx) max_tokens = std::max(64, e->n_ctx - nt);
    if (nt + 64 > e->n_ctx) return err(env, "问题和资料太长");

    // 每次都是一次完整的新对话：清空上一次的缓存
    llama_memory_clear(llama_get_memory(e->ctx), true);

    // 读提示词：每批 512 个 token
    for (int i = 0; i < nt; i += 512) {
        const int m = std::min(512, nt - i);
        llama_batch b = llama_batch_get_one(toks.data() + i, m);
        if (llama_decode(e->ctx, b) != 0) return err(env, "读取提示词失败");
        if (e->stop) return to_bytes(env, "");
    }
    env->CallVoidMethod(cb, onPrefill, nt);

    // 采样：Qwen3 非思考模式推荐 top_k 20、top_p 0.8；温度低一点让回答更贴近资料；轻微惩罚重复
    llama_sampler *smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(smpl, llama_sampler_init_penalties(llama_vocab_n_tokens(e->vocab), 64, 1.05f, 0.0f, 0.0f));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_k(20));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_p(0.8f, 1));
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(temp));
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    std::string out, pending;
    char piece[256];
    for (int i = 0; i < max_tokens && !e->stop; i++) {
        llama_token id = llama_sampler_sample(smpl, e->ctx, -1);
        if (llama_vocab_is_eog(e->vocab, id)) break;
        const int k = llama_token_to_piece(e->vocab, id, piece, sizeof(piece), 0, false);
        if (k > 0) pending.append(piece, k);
        const size_t ok = utf8_complete(pending);
        if (ok > 0) {
            const std::string chunk = pending.substr(0, ok);
            pending.erase(0, ok);
            out += chunk;
            jbyteArray jb = to_bytes(env, chunk);
            env->CallVoidMethod(cb, onToken, jb);
            env->DeleteLocalRef(jb);
        }
        llama_batch b = llama_batch_get_one(&id, 1);
        if (llama_decode(e->ctx, b) != 0) break;
    }
    out += pending;
    llama_sampler_free(smpl);
    return to_bytes(env, out);
}

JNIEXPORT void JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeStop(JNIEnv *, jclass, jlong handle) {
    auto *e = reinterpret_cast<Engine *>(handle);
    if (e) e->stop = true;
}

JNIEXPORT void JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeFree(JNIEnv *, jclass, jlong handle) {
    auto *e = reinterpret_cast<Engine *>(handle);
    if (!e) return;
    llama_free(e->ctx);
    llama_model_free(e->model);
    delete e;
}

}  // extern "C"
