package com.abigcyan.lianchi;

import android.app.ActivityManager;
import android.content.Context;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * 内置大模型：在手机上用 llama.cpp 跑 GGUF 小模型（见 src/main/cpp/llm.cpp）。
 * 模型文件由 JS 端用 @capacitor/filesystem 下载到 App 私有目录，这里只负责加载和生成。
 * 所有模型调用都放在同一个后台线程里执行；stop 可以随时调用。
 */
@CapacitorPlugin(name = "LocalLlm")
public class LocalLlmPlugin extends Plugin {

    private static boolean libOk = false;
    private static String libErr = "";

    static {
        try {
            System.loadLibrary("lianchi_llm");
            libOk = true;
        } catch (Throwable t) {
            libErr = String.valueOf(t.getMessage());
        }
    }

    private static native long nativeLoad(String path, int nCtx, int threads);
    private static native byte[] nativeGenerate(long handle, byte[][] roles, byte[][] contents, int maxTokens, float temp, Callback cb);
    private static native void nativeStop(long handle);
    private static native void nativeFree(long handle);

    /** 原生层回调：每出一段文字、读完提示词时通知 JS */
    public interface Callback {
        void onToken(byte[] text);
        void onPrefill(int tokens);
    }

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile long handle = 0;
    private volatile String loadedPath = "";

    /** 编译时用了 armv8.2 dotprod 指令，旧 CPU 不支持会直接崩溃，所以先检查 */
    private static String cpuFeatures() {
        try (BufferedReader r = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
            String line;
            while ((line = r.readLine()) != null) if (line.startsWith("Features")) return line;
        } catch (Exception ignored) { }
        return "";
    }

    private static boolean cpuOk() {
        String f = cpuFeatures();
        return f.contains("asimddp") && f.contains("fphp");
    }

    private static String pathOf(String p) {
        if (p == null) return "";
        return p.startsWith("file://") ? Uri.parse(p).getPath() : p;
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        boolean cpu = cpuOk();
        ret.put("available", libOk && cpu);
        ret.put("reason", !libOk ? "没有内置模型组件（" + libErr + "）" : !cpu ? "这台手机的 CPU 不支持（需要 ARMv8.2 dotprod）" : "");
        ret.put("loaded", handle != 0);
        ret.put("modelPath", loadedPath);
        ret.put("cores", Runtime.getRuntime().availableProcessors());
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        ret.put("ramMB", mi.totalMem / 1048576);
        ret.put("availMB", mi.availMem / 1048576);
        call.resolve(ret);
    }

    @PluginMethod
    public void load(PluginCall call) {
        if (!libOk || !cpuOk()) { call.reject("这台手机不能运行内置模型"); return; }
        final String path = pathOf(call.getString("path"));
        final int nCtx = call.getInt("nCtx", 4096);
        final int threads = call.getInt("threads", 4);
        if (!new File(path).exists()) { call.reject("模型文件不存在：" + path); return; }
        worker.execute(() -> {
            try {
                if (handle != 0 && path.equals(loadedPath)) { JSObject r = new JSObject(); r.put("ms", 0); call.resolve(r); return; }
                if (handle != 0) { nativeFree(handle); handle = 0; loadedPath = ""; }
                long t0 = System.currentTimeMillis();
                long h = nativeLoad(path, nCtx, threads);
                if (h == 0) { call.reject("模型加载失败（文件可能没下载完整，或内存不够）"); return; }
                handle = h;
                loadedPath = path;
                JSObject r = new JSObject();
                r.put("ms", System.currentTimeMillis() - t0);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("模型加载失败：" + t.getMessage());
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        if (handle == 0) { call.reject("模型还没加载"); return; }
        JSArray msgs = call.getArray("messages");
        final int maxTokens = call.getInt("maxTokens", 512);
        final float temp = call.getFloat("temperature", 0.3f);
        final byte[][] roles, contents;
        try {
            int n = msgs.length();
            roles = new byte[n][];
            contents = new byte[n][];
            for (int i = 0; i < n; i++) {
                JSONObject m = msgs.getJSONObject(i);
                roles[i] = m.optString("role", "user").getBytes(StandardCharsets.UTF_8);
                contents[i] = m.optString("content", "").getBytes(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            call.reject("消息格式不对");
            return;
        }
        worker.execute(() -> {
            final long t0 = System.currentTimeMillis();
            final long[] prefillAt = {0};
            final int[] counts = {0, 0};  // 提示词 token 数、生成的段数
            try {
                byte[] out = nativeGenerate(handle, roles, contents, maxTokens, temp, new Callback() {
                    @Override
                    public void onToken(byte[] text) {
                        counts[1]++;
                        JSObject ev = new JSObject();
                        ev.put("text", new String(text, StandardCharsets.UTF_8));
                        notifyListeners("token", ev);
                    }

                    @Override
                    public void onPrefill(int tokens) {
                        counts[0] = tokens;
                        prefillAt[0] = System.currentTimeMillis();
                        JSObject ev = new JSObject();
                        ev.put("tokens", tokens);
                        ev.put("ms", prefillAt[0] - t0);
                        notifyListeners("prefill", ev);
                    }
                });
                String text = new String(out, StandardCharsets.UTF_8);
                if (text.startsWith("\u0001ERR:")) { call.reject(text.substring(5)); return; }
                long t1 = System.currentTimeMillis();
                JSObject r = new JSObject();
                r.put("text", text);
                r.put("promptTokens", counts[0]);
                r.put("pieces", counts[1]);
                r.put("prefillMs", prefillAt[0] > 0 ? prefillAt[0] - t0 : t1 - t0);
                r.put("genMs", prefillAt[0] > 0 ? t1 - prefillAt[0] : 0);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("生成失败：" + t.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (handle != 0) nativeStop(handle);
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        if (handle != 0) nativeStop(handle);
        worker.execute(() -> {
            if (handle != 0) { nativeFree(handle); handle = 0; loadedPath = ""; }
            call.resolve();
        });
    }
}
