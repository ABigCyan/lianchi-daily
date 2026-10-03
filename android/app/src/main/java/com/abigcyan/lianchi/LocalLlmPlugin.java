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
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
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
    private static native byte[] nativeGenerate(long handle, byte[][] roles, byte[][] contents, int maxTokens, float temp, boolean noThink, Callback cb);
    private static native void nativeStop(long handle);
    private static native void nativeFree(long handle);

    /** 原生层回调：每出一段文字、读完提示词时通知 JS */
    public interface Callback {
        void onToken(byte[] text);
        void onPrefill(int tokens);
    }

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService downloader = Executors.newSingleThreadExecutor();
    private volatile boolean dlCancel = false;
    private volatile boolean dlRunning = false;
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
        final boolean noThink = call.getBoolean("noThink", true);
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
                byte[] out = nativeGenerate(handle, roles, contents, maxTokens, temp, noThink, new Callback() {
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

    /** 模型目录：App 私有目录 files/models（卸载 App 时一起删除） */
    private File modelDir() {
        File d = new File(getContext().getFilesDir(), "models");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    /** 模型文件信息：是否下载完整、已下载多少（没下完的在 .part 里） */
    @PluginMethod
    public void fileInfo(PluginCall call) {
        String name = call.getString("file", "");
        long size = call.getLong("size", 0L);
        File f = new File(modelDir(), name), part = new File(modelDir(), name + ".part");
        JSObject r = new JSObject();
        r.put("done", f.exists() && (size <= 0 || f.length() == size));
        r.put("partial", part.exists() ? part.length() : 0);
        r.put("path", f.getAbsolutePath());
        r.put("downloading", dlRunning);
        call.resolve(r);
    }

    /**
     * 下载模型：断点续传（先写 .part，完成后改名），每 300ms 通知一次进度 "download" {file, bytes, total}。
     * 大文件不经过 JS，也不怕页面切换；cancelDownload 可以随时停下，下次接着下。
     */
    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url"), name = call.getString("file");
        final long expect = call.getLong("size", 0L);
        if (url == null || name == null || name.contains("/")) { call.reject("参数不对"); return; }
        if (dlRunning) { call.reject("已经在下载了"); return; }
        dlCancel = false;
        dlRunning = true;
        downloader.execute(() -> {
            File part = new File(modelDir(), name + ".part"), out = new File(modelDir(), name);
            HttpURLConnection c = null;
            try {
                long have = part.exists() ? part.length() : 0;
                String loc = url;
                for (int hop = 0; hop < 6; hop++) {  // 自己跟随跳转，保证 Range 头带到最终地址
                    c = (HttpURLConnection) new URL(loc).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(30000);
                    c.setRequestProperty("User-Agent", "lianchi-daily");
                    if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                        loc = new URL(new URL(loc), c.getHeaderField("Location")).toString();
                        c.disconnect();
                        continue;
                    }
                    break;
                }
                int code = c.getResponseCode();
                if (code == 416 && expect > 0 && have == expect) { /* 已经下完 */ }
                else if (code != 200 && code != 206) throw new Exception("服务器返回 " + code);
                if (code == 200) have = 0;  // 不支持续传：从头下
                long total = expect > 0 ? expect : (code == 206 ? have + c.getContentLengthLong() : c.getContentLengthLong());
                if (code != 416) {
                    try (InputStream in = c.getInputStream(); RandomAccessFile raf = new RandomAccessFile(part, "rw")) {
                        raf.setLength(have);
                        raf.seek(have);
                        byte[] buf = new byte[256 * 1024];
                        long last = 0;
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            if (dlCancel) throw new InterruptedException("已暂停");
                            raf.write(buf, 0, n);
                            have += n;
                            long now = System.currentTimeMillis();
                            if (now - last > 300) { last = now; progress(name, have, total, false, null); }
                        }
                    }
                }
                if (expect > 0 && part.length() != expect) throw new Exception("文件不完整（" + part.length() + "/" + expect + "），再点一次会接着下载");
                if (out.exists()) out.delete();
                if (!part.renameTo(out)) throw new Exception("保存失败");
                progress(name, out.length(), out.length(), true, null);
                JSObject r = new JSObject();
                r.put("path", out.getAbsolutePath());
                call.resolve(r);
            } catch (InterruptedException e) {
                progress(name, part.length(), expect, false, "已暂停");
                call.reject("已暂停");
            } catch (Exception e) {
                progress(name, part.length(), expect, false, String.valueOf(e.getMessage()));
                call.reject("下载失败：" + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
                dlRunning = false;
            }
        });
    }

    private void progress(String file, long bytes, long total, boolean done, String error) {
        JSObject ev = new JSObject();
        ev.put("file", file);
        ev.put("bytes", bytes);
        ev.put("total", total);
        ev.put("done", done);
        if (error != null) ev.put("error", error);
        notifyListeners("download", ev);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        dlCancel = true;
        call.resolve();
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String name = call.getString("file", "");
        if (name.contains("/")) { call.reject("参数不对"); return; }
        File f = new File(modelDir(), name), part = new File(modelDir(), name + ".part");
        if (handle != 0 && loadedPath.equals(f.getAbsolutePath())) { nativeStop(handle); worker.execute(() -> { nativeFree(handle); handle = 0; loadedPath = ""; }); }
        f.delete();
        part.delete();
        call.resolve();
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
