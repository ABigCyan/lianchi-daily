// 内置大模型的 JNI 桥：Java 端见 LocalLlmPlugin.java，真正的工作在 llm-core.cpp（电脑上也能单独编译测试）。
// 所有调用都在同一个后台线程里，只有 nativeStop 会从别的线程调用。
#include <jni.h>
#include <android/log.h>
#include <string>
#include <vector>
#include "llama.h"
#include "mtmd.h"
#include "mtmd-helper.h"
#include "llm-core.h"

#define TAG "lianchi-llm"
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)

namespace {

void log_cb(ggml_log_level level, const char *text, void *) {
    if (level >= GGML_LOG_LEVEL_WARN) LOGW("%s", text);
}

// Java 传字节数组（UTF-8），避免 NewStringUTF 对 emoji 等 4 字节字符出错
std::string bytes(JNIEnv *env, jbyteArray a) {
    if (!a) return "";
    const jsize n = env->GetArrayLength(a);
    std::string s(n, '\0');
    if (n) env->GetByteArrayRegion(a, 0, n, reinterpret_cast<jbyte *>(&s[0]));
    return s;
}

jbyteArray to_bytes(JNIEnv *env, const std::string &s) {
    jbyteArray a = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(a, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
    return a;
}

std::string str(JNIEnv *env, jstring s) {
    if (!s) return "";
    const char *c = env->GetStringUTFChars(s, nullptr);
    std::string out(c ? c : "");
    if (c) env->ReleaseStringUTFChars(s, c);
    return out;
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeLoad(JNIEnv *env, jclass, jstring jpath, jint n_ctx, jint threads) {
    static bool logs = false;
    if (!logs) {
        llama_log_set(log_cb, nullptr);
        mtmd_helper_log_set(log_cb, nullptr);
        logs = true;
    }
    const std::string path = str(env, jpath);
    return reinterpret_cast<jlong>(lcore::load(path.c_str(), n_ctx, threads));
}

JNIEXPORT jboolean JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeLoadVision(JNIEnv *env, jclass, jlong handle, jstring jpath, jint threads) {
    const std::string path = str(env, jpath);
    return lcore::load_vision(reinterpret_cast<lcore::Engine *>(handle), path.c_str(), threads) ? JNI_TRUE : JNI_FALSE;
}

// 生成：messages 按 role/content 两个数组传入（UTF-8 字节）；image 是图片文件路径（可以为 null）；
// 每出一段文字回调 cb.onToken(byte[])，提示词读完时回调 cb.onPrefill(int 提示词词元数)。返回完整文字；出错时以 \x01ERR: 开头
JNIEXPORT jbyteArray JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeGenerate(JNIEnv *env, jclass, jlong handle, jobjectArray roles, jobjectArray contents,
                                                       jint max_tokens, jfloat temp, jboolean no_think, jstring jimage, jobject cb) {
    jclass cbc = env->GetObjectClass(cb);
    jmethodID onToken = env->GetMethodID(cbc, "onToken", "([B)V");
    jmethodID onPrefill = env->GetMethodID(cbc, "onPrefill", "(I)V");
    const jsize n = env->GetArrayLength(roles);
    std::vector<std::string> R(n), C(n);
    for (jsize i = 0; i < n; i++) {
        auto r = (jbyteArray) env->GetObjectArrayElement(roles, i);
        auto c = (jbyteArray) env->GetObjectArrayElement(contents, i);
        R[i] = bytes(env, r);
        C[i] = bytes(env, c);
        env->DeleteLocalRef(r);
        env->DeleteLocalRef(c);
    }
    const std::string image = str(env, jimage);
    const std::string out = lcore::generate(
        reinterpret_cast<lcore::Engine *>(handle), R, C, max_tokens, temp, no_think == JNI_TRUE, image.empty() ? nullptr : image.c_str(),
        [&](const std::string &chunk) {
            jbyteArray jb = to_bytes(env, chunk);
            env->CallVoidMethod(cb, onToken, jb);
            env->DeleteLocalRef(jb);
        },
        [&](int tokens) { env->CallVoidMethod(cb, onPrefill, tokens); });
    return to_bytes(env, out);
}

JNIEXPORT void JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeStop(JNIEnv *, jclass, jlong handle) {
    lcore::stop(reinterpret_cast<lcore::Engine *>(handle));
}

JNIEXPORT void JNICALL
Java_com_abigcyan_lianchi_LocalLlmPlugin_nativeFree(JNIEnv *, jclass, jlong handle) {
    lcore::free_engine(reinterpret_cast<lcore::Engine *>(handle));
}

}  // extern "C"
