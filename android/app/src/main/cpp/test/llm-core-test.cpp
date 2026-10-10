// 用法：llm-core-test 模型.gguf [mmproj.gguf 图片.jpg]
// 先问一个文字问题，再（给了 mmproj 和图片时）带图提问，打印回答、词元数和耗时。
#include <chrono>
#include <cstdio>
#include "llm-core.h"

static double now() { return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count(); }

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "用法：%s 模型.gguf [mmproj.gguf 图片.jpg]\n", argv[0]); return 2; }
    double t = now();
    lcore::Engine *e = lcore::load(argv[1], 8192, 4);
    if (!e) { fprintf(stderr, "模型加载失败\n"); return 1; }
    printf("加载 %.1fs\n", now() - t);
    // 和 App 里 ai-local.js 用的提示词一样
    const char *VISION = "用中文一两句话说出照片里是什么。是健身器械就说名称和主要练哪里；是动作就说动作名称；是食物就说名称和大概分量。照片里没有的东西不要提，看不清就说看不清，不超过 60 字。";
    const char *FOOD = "你在看一张照片，找出里面的食物。每种食物只写一行，格式是“食物名 克数g”，例如“米饭 200g”“鸡腿 1个”“西兰花 100g”。克数按熟重估。同一种食物不要重复写，最多写 8 行。照片里没有食物，就只回答“没有食物”。只输出这些行，不要别的话。";
    auto run = [&](const char *q, const char *img, const char *sys = "用中文简短回答。", int max = 160) {
        int n = 0; double t0 = now(), tp = 0;
        std::string out = lcore::generate(e, {"system", "user"}, {sys, q}, max, 0.2f, true, img,
            [&](const std::string &s) { (void) s; }, [&](int k) { n = k; tp = now(); });
        printf("问：%s%s\n答：%s\n（提示词 %d 词元，读 %.1fs，生成 %.1fs）\n\n", q, img ? " [带图]" : "", out.c_str(), n, tp - t0, now() - tp);
        return out;
    };
    std::string a = run("减脂期间每天应该吃多少蛋白质？一句话。", nullptr);
    if (a.rfind("\x01ERR:", 0) == 0) return 1;
    if (argc >= 4) {
        t = now();
        if (!lcore::load_vision(e, argv[2], 4)) { fprintf(stderr, "看图组件加载失败\n"); return 1; }
        printf("看图组件加载 %.1fs\n", now() - t);
        for (int i = 3; i < argc; i++) {
            std::string b = run("这是什么？", argv[i], VISION, 200);
            if (b.empty() || b.rfind("\x01ERR:", 0) == 0) return 1;
            run("照片里有哪些食物，各多少克？", argv[i], FOOD, 140);
        }
    }
    lcore::free_engine(e);
    return 0;
}
