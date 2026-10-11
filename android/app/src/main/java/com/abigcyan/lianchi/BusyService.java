package com.abigcyan.lianchi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * 助手回答期间的前台服务：切到别的 App、锁屏时，系统不会把本 App 冻结或杀掉，回答（云端请求或内置模型生成）能在后台跑完。
 * 通知栏显示“助手正在回答…”，点一下回到 App。回答完由 BusyPlugin.stop() 停掉；最多跑 15 分钟，防止忘了停。
 */
public class BusyService extends Service {
    static final String CH_BUSY = "busy", CH_DONE = "busy_done";
    static final int ID_BUSY = 7101, ID_DONE = 7102;
    private PowerManager.WakeLock lock;

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH_BUSY) == null) {
            NotificationChannel ch = new NotificationChannel(CH_BUSY, "助手后台运行", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("助手在后台回答时显示");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_DONE) == null) {
            NotificationChannel ch = new NotificationChannel(CH_DONE, "助手回答好了", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("在别的 App 里时，助手回答完提醒一下");
            nm.createNotificationChannel(ch);
        }
    }

    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        channels(this);
        String text = intent != null && intent.getStringExtra("text") != null ? intent.getStringExtra("text") : "助手正在回答…";
        Notification n = new NotificationCompat.Builder(this, CH_BUSY)
            .setSmallIcon(R.drawable.ic_stat_ai)
            .setContentTitle("练好吃对")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setProgress(0, 0, true)
            .setContentIntent(openApp(this))
            .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
        try {
            ServiceCompat.startForeground(this, ID_BUSY, n, type);
        } catch (Exception e) {
            // 系统不让开前台服务（比如已经在后台）：就不保活了，回答照常进行
            stopSelf();
            return START_NOT_STICKY;
        }
        if (lock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lianchi:assistant");
            lock.setReferenceCounted(false);
        }
        lock.acquire(15 * 60 * 1000L);
        return START_NOT_STICKY;
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
