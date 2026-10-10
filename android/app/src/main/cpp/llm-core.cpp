// 内置大模型的核心：llama.cpp 跑 GGUF 小模型（CPU），看图用 mtmd（Qwen3.5 是图文模型，配一个 mmproj 文件）。
// 所有调用都在同一个线程里执行，只有 stop 会从别的线程调用。
#include "llm-core.h"

#include <algorithm>
#include <atomic>
#include <cstring>

#include "llama.h"
#include "mtmd.h"
#include "mtmd-helper.h"

namespace lcore {

struct Engine {
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    const llama_vocab *vocab = nullptr;
    mtmd_context *mctx = nullptr;
    int n_ctx = 4096;
    std::atomic<bool> stop{false};
};

namespace {

std::string err(const char *msg) { return std::string("\x01ERR:") + msg; }

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

bool inited = false;

}  // namespace

Engine *load(const char *path, int n_ctx, int threads) {
    if (!inited) {
        llama_backend_init();
        inited = true;
    }
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    llama_model *model = llama_model_load_from_file(path, mp);
    if (!model) return nullptr;
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) n_ctx;
    cp.n_batch = 512;
    cp.n_ubatch = 512;
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    llama_context *ctx = llama_init_from_model(model, cp);
    if (!ctx) {
        llama_model_free(model);
        return nullptr;
    }
    auto *e = new Engine();
    e->model = model;
    e->ctx = ctx;
    e->vocab = llama_model_get_vocab(model);
    e->n_ctx = n_ctx;
    return e;
}

bool load_vision(Engine *e, const char *mmproj_path, int threads) {
    if (!e) return false;
    if (e->mctx) {
        mtmd_free(e->mctx);
        e->mctx = nullptr;
    }
    mtmd_context_params p = mtmd_context_params_default();
    p.use_gpu = false;
    p.print_timings = false;
    p.n_threads = threads;
    p.warmup = false;          // 第一次看图时再算，打开 App 不用等
    p.image_max_tokens = 400;  // 图片最多变成 400 个词元：手机 CPU 上再多就太慢了
    e->mctx = mtmd_init_from_file(mmproj_path, e->model, p);
    return e->mctx != nullptr && mtmd_support_vision(e->mctx);
}

bool has_vision(const Engine *e) { return e && e->mctx; }

std::string generate(Engine *e, const std::vector<std::string> &roles, const std::vector<std::string> &contents,
                     int max_tokens, float temp, bool no_think, const char *image,
                     const std::function<void(const std::string &)> &on_token, const std::function<void(int)> &on_prefill) {
    if (!e) return err("模型没有加载");
    e->stop = false;
    const bool with_image = image && *image;
    if (with_image && !e->mctx) return err("看图组件没有加载");

    // 带图时，在最后一条用户消息前面放图片标记，mtmd 会把它换成图片
    std::vector<std::string> C = contents;
    if (with_image) {
        for (int i = (int) roles.size() - 1; i >= 0; --i)
            if (roles[i] == "user") {
                C[i] = std::string(mtmd_default_marker()) + "\n" + C[i];
                break;
            }
    }
    std::vector<llama_chat_message> msgs(roles.size());
    size_t total = 0;
    for (size_t i = 0; i < roles.size(); i++) {
        msgs[i] = {roles[i].c_str(), C[i].c_str()};
        total += roles[i].size() + C[i].size();
    }
    const char *tmpl = llama_model_chat_template(e->model, nullptr);
    std::vector<char> buf(total * 2 + 1024);
    int len = llama_chat_apply_template(tmpl, msgs.data(), msgs.size(), true, buf.data(), (int32_t) buf.size());
    if (len > (int) buf.size()) {
        buf.resize(len + 1);
        len = llama_chat_apply_template(tmpl, msgs.data(), msgs.size(), true, buf.data(), (int32_t) buf.size());
    }
    if (len < 0) return err("模型的对话模板不支持");
    std::string prompt(buf.data(), len);
    // 关掉思考：和 Qwen3 / Qwen3.5 模板在 enable_thinking=false 时渲染的一样，在助手开头接一个空的思考块
    auto ends = [&prompt](const char *t) { const size_t n = strlen(t); return prompt.size() >= n && prompt.compare(prompt.size() - n, n, t) == 0; };
    if (no_think) {
        if (ends("assistant\n<think>\n")) prompt += "\n</think>\n\n";      // 模板已经开了思考块：直接合上
        else if (ends("assistant\n")) prompt += "<think>\n\n</think>\n\n";  // ChatML（llama.cpp 内置模板走这里）
    }

    // 每次都是一次完整的新对话：清空上一次的缓存
    llama_memory_clear(llama_get_memory(e->ctx), true);
    llama_pos n_past = 0;
    int n_prompt = 0;

    if (with_image) {
        // 图片 + 文字：mtmd 把提示词切成文字段和图片段，图片先过视觉编码器，再和文字一起读进模型
        mtmd_helper_bitmap_wrapper bw = mtmd_helper_bitmap_init_from_file(e->mctx, image, false, mtmd_helper_init_opt_default());
        if (!bw.bitmap) return err("图片读不出来");
        mtmd_input_text txt{prompt.c_str(), prompt.size(), true, true};
        mtmd_input_chunks *chunks = mtmd_input_chunks_init();
        const mtmd_bitmap *bm[1] = {bw.bitmap};
        const int32_t tk = mtmd_tokenize(e->mctx, chunks, &txt, bm, 1);
        mtmd_bitmap_free(bw.bitmap);
        if (tk != 0) {
            mtmd_input_chunks_free(chunks);
            return err("图片处理失败");
        }
        n_prompt = (int) mtmd_helper_get_n_tokens(chunks);
        if (n_prompt + 64 > e->n_ctx) {
            mtmd_input_chunks_free(chunks);
            return err("问题和图片太长");
        }
        const int32_t ev = mtmd_helper_eval_chunks(e->mctx, e->ctx, chunks, 0, 0, 512, true, &n_past);
        mtmd_input_chunks_free(chunks);
        if (ev != 0) return err("读取图片失败");
        if (e->stop) return "";
    } else {
        int nt = -llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
        std::vector<llama_token> toks(std::max(nt, 1));
        nt = llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(), (int32_t) toks.size(), true, true);
        if (nt <= 0) return err("分词失败");
        if (nt + 64 > e->n_ctx) return err("问题和资料太长");
        // 读提示词：每批 512 个词元
        for (int i = 0; i < nt; i += 512) {
            const int m = std::min(512, nt - i);
            llama_batch b = llama_batch_get_one(toks.data() + i, m);
            if (llama_decode(e->ctx, b) != 0) return err("读取提示词失败");
            if (e->stop) return "";
        }
        n_prompt = nt;
        n_past = nt;
    }
    if (n_prompt + max_tokens > e->n_ctx) max_tokens = std::max(64, e->n_ctx - n_prompt);
    on_prefill(n_prompt);

    // 采样：Qwen3 非思考模式推荐 top_k 20、top_p 0.8；温度低一点让回答更贴近资料；轻微惩罚重复
    llama_sampler *smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(smpl, llama_sampler_init_penalties(llama_vocab_n_tokens(e->vocab), 64, 1.05f, 0.0f, 0.0f));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_k(20));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_p(0.8f, 1));
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(temp));
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    // 生成的词元按位置一个个读回去（带图时位置数和词元数不一样，所以显式给位置）
    llama_batch one = llama_batch_init(1, 0, 1);
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
            on_token(chunk);
        }
        one.n_tokens = 1;
        one.token[0] = id;
        one.pos[0] = n_past++;
        one.n_seq_id[0] = 1;
        one.seq_id[0][0] = 0;
        one.logits[0] = true;
        if (llama_decode(e->ctx, one) != 0) break;
    }
    llama_batch_free(one);
    out += pending;
    llama_sampler_free(smpl);
    return out;
}

void stop(Engine *e) {
    if (e) e->stop = true;
}

void free_engine(Engine *e) {
    if (!e) return;
    if (e->mctx) mtmd_free(e->mctx);
    llama_free(e->ctx);
    llama_model_free(e->model);
    delete e;
}

}  // namespace lcore
