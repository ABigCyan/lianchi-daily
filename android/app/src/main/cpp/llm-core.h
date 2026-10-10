// 内置大模型的核心（不依赖 JNI）：加载模型、加载看图组件、生成。
// 安卓上由 llm.cpp 的 JNI 函数调用；电脑上可以直接编译 test/llm-core-test.cpp 用真实模型测试同一份代码。
#pragma once
#include <functional>
#include <string>
#include <vector>

namespace lcore {

struct Engine;

// 加载 GGUF 模型；失败返回 nullptr
Engine *load(const char *path, int n_ctx, int threads);
// 加载视觉投影文件（mmproj），之后 generate 可以带一张图片；失败返回 false
bool load_vision(Engine *e, const char *mmproj_path, int threads);
bool has_vision(const Engine *e);

// 生成：roles / contents 是对话（system / user / assistant）；image 是图片文件路径（可以为空）。
// 每出一段完整的 UTF-8 文字回调 on_token，读完提示词时回调 on_prefill(提示词词元数)。
// 返回完整文字；出错时返回以 "\x01ERR:" 开头的说明。
std::string generate(Engine *e, const std::vector<std::string> &roles, const std::vector<std::string> &contents,
                     int max_tokens, float temp, bool no_think, const char *image,
                     const std::function<void(const std::string &)> &on_token, const std::function<void(int)> &on_prefill);

void stop(Engine *e);   // 可以从别的线程调用
void free_engine(Engine *e);

}  // namespace lcore
