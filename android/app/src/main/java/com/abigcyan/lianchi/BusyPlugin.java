package com.abigcyan.lianchi;

import android.Manifest;
import android.app.Notification;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 页面调用：start() 开始保活（BusyService），stop({done}) 结束；App 不在前台时，done 有内容就发一条“回答好了”的通知 */
@CapacitorPlugin(name = "Busy")
public class BusyPlugin extends Plugin {
    private boolean front = true;

    @Override
    protected void handleOnResume() {
        front = true;
        NotificationManagerCompat.from(getContext()).cancel(BusyService.ID_DONE);
    }

    @Override
    protected void handleOnPause() {
        front = false;
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), BusyService.class).putExtra("text", call.getString("text", "助手正在回答…"));
        try {
            ContextCompat.startForegroundService(getContext(), i);
        } catch (Exception e) {
            // 开不了也不影响回答
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BusyService.class));
        String done = call.getString("done", "");
        boolean canNotify = Build.VERSION.SDK_INT < 33
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if (!front && canNotify && done != null && !done.isEmpty()) {
            try {
                BusyService.channels(getContext());
                Notification n = new NotificationCompat.Builder(getContext(), BusyService.CH_DONE)
                    .setSmallIcon(R.drawable.ic_stat_ai)
                    .setContentTitle("助手回答好了")
                    .setContentText(done)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(done))
                    .setAutoCancel(true)
                    .setContentIntent(BusyService.openApp(getContext()))
                    .build();
                NotificationManagerCompat.from(getContext()).notify(BusyService.ID_DONE, n);
            } catch (SecurityException e) {
                // 没有通知权限：不提醒
            }
        }
        call.resolve();
    }
}
