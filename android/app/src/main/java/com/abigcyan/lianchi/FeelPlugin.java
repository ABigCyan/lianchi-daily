package com.abigcyan.lianchi;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 触感反馈：清脆、可调强度。
 * 原来用的 @capacitor/haptics 在安卓上是 20-60 毫秒的长震，线性马达上也会“嗡”一下；
 * 这里改用系统的触感原语（Android 11+，CLICK / TICK，按强度缩放），手机不支持时退到预设效果（Android 10）、
 * 再退到很短的单次震动（2-12 毫秒，能调幅度的按强度调）。
 * style=system 时交给系统的按键触感（各手机厂商自己调过的效果，跟随系统“触感反馈”开关）。
 */
@CapacitorPlugin(name = "Feel")
public class FeelPlugin extends Plugin {

    private Vibrator vib;

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vib = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vib = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("vibrator", vib != null && vib.hasVibrator());
        r.put("primitives", primitives());
        r.put("amplitude", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vib != null && vib.hasAmplitudeControl());
        r.put("predefined", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q);
        call.resolve(r);
    }

    /** kind：tick 滚轮刻度 / light 轻点 / medium 长按、完成一组 / heavy / success 完成 / warn 出错；strength 0-1；style crisp 或 system */
    @PluginMethod
    public void play(PluginCall call) {
        String kind = call.getString("kind", "light");
        Float s = call.getFloat("strength", 0.6f);
        float strength = Math.max(0.05f, Math.min(1f, s == null ? 0.6f : s));
        String style = call.getString("style", "crisp");
        try {
            if ("system".equals(style)) system(kind);
            else crisp(kind, strength);
        } catch (Exception e) {
            // 震不了不影响使用
        }
        call.resolve();
    }

    private boolean primitives() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || vib == null) return false;
        return vib.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK, VibrationEffect.Composition.PRIMITIVE_TICK);
    }

    private void crisp(String kind, float k) {
        if (vib == null || !vib.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && primitives()) {
            VibrationEffect.Composition c = VibrationEffect.startComposition();
            switch (kind) {
                case "tick":
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, k);
                    break;
                case "light":
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, k * 0.7f);
                    break;
                case "success":
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, k * 0.8f);
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, k, 70);
                    break;
                case "warn":
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, k);
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, k, 90);
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, k, 60);
                    break;
                case "heavy":
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f);
                    break;
                default: // medium
                    c.addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, Math.min(1f, k * 1.15f));
            }
            vib.vibrate(c.compose());
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int e;
            switch (kind) {
                case "tick":
                    e = VibrationEffect.EFFECT_TICK;
                    break;
                case "success":
                    e = VibrationEffect.EFFECT_DOUBLE_CLICK;
                    break;
                case "heavy":
                case "warn":
                    e = VibrationEffect.EFFECT_HEAVY_CLICK;
                    break;
                case "light":
                    e = k < 0.5f ? VibrationEffect.EFFECT_TICK : VibrationEffect.EFFECT_CLICK;
                    break;
                default:
                    e = k < 0.75f ? VibrationEffect.EFFECT_CLICK : VibrationEffect.EFFECT_HEAVY_CLICK;
            }
            vib.vibrate(VibrationEffect.createPredefined(e));
            return;
        }
        // 老手机：很短的一下；能调幅度的按强度调
        int ms = "tick".equals(kind) ? 4 : "light".equals(kind) ? 7 : "heavy".equals(kind) ? 14 : 10;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int amp = vib.hasAmplitudeControl() ? Math.max(1, Math.round(255 * k)) : VibrationEffect.DEFAULT_AMPLITUDE;
            if ("success".equals(kind) || "warn".equals(kind)) {
                vib.vibrate(VibrationEffect.createWaveform(new long[] { 0, ms, 70, ms }, new int[] { 0, amp, 0, amp }, -1));
            } else {
                vib.vibrate(VibrationEffect.createOneShot(ms, amp));
            }
        } else {
            vib.vibrate(ms);
        }
    }

    private void system(String kind) {
        final int c;
        switch (kind) {
            case "tick":
                c = HapticFeedbackConstants.CLOCK_TICK;
                break;
            case "success":
                c = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS;
                break;
            case "warn":
                c = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
                break;
            case "light":
                c = HapticFeedbackConstants.KEYBOARD_TAP;
                break;
            default:
                c = HapticFeedbackConstants.LONG_PRESS;
        }
        getActivity()
            .runOnUiThread(() -> {
                View v = getBridge().getWebView();
                if (v != null) v.performHapticFeedback(c);
            });
    }
}
