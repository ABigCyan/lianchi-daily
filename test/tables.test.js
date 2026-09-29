// 用法：node test/tables.test.js —— 把 App 的有氧消耗计算和原表表16 的每一个计算结果逐格对照（原表公式 =ROUND($E*体重*系数,-1)）
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-tables.js', 'data-rules.js', 'data-training.js', 'holidays.js', 'engine.js']) vm.runInContext(fs.readFileSync(__dirname + '/../www/js/' + f, 'utf8'), ctx);
const E = ctx.Engine, T = JSON.parse(fs.readFileSync(__dirname + '/fixtures/table16.json', 'utf8'));
let n = 0, bad = [];
for (const [row, x] of Object.entries(T.rows)) {
  const r = +row;
  T.weights.forEach((w, i) => {
    const want = x.values[i];
    let got;
    if (r >= 94 && r <= 103) got = E.cardioPerHour({ kind: '跑步', pace: 60 / parseFloat(x.item) }, w).kcal;
    else {
      const row16 = ctx.CARDIO.find(c => c.src === '表16 E' + r);
      assert.ok(row16, '表16 第' + r + '行没有收进 App');
      got = E.cardioPerHour({ kind: row16.label }, w).kcal;
    }
    n++;
    if (got !== want) bad.push(`第${r}行 ${x.item} ${w}kg：原表 ${want}，App ${got}`);
  });
}
// 表16 方法一（心率法，第14-79行）用的体重系数
const HR = Object.entries(JSON.parse(fs.readFileSync(__dirname + '/fixtures/table16.json', 'utf8')).rows).filter(([r]) => +r < 80);
console.log(`表16 方法二：${n} 个格子逐一对照，${bad.length} 个不一致`);
bad.slice(0, 20).forEach(b => console.log('  ' + b));
assert.strictEqual(bad.length, 0);
console.log('表16 全部一致');
// 表25：原表示例（配重 50kg，力竭 10 次）F11 Lombardi = 10^0.1×50，F9 Brzycki = 50/(1.0278−0.0278×10)
assert.strictEqual(E.oneRM(50, 10, 'M').toFixed(4), (Math.pow(10, 0.1) * 50).toFixed(4));
assert.strictEqual(E.oneRM(50, 10, 'F').toFixed(4), (50 / (1.0278 - 0.0278 * 10)).toFixed(4));
// 表19：全部 103 种食物都收进了 App
const F19 = ctx.FOOD19; assert.strictEqual(F19.carb.length + F19.protein.length + F19.mixed.length, 103);
console.log('表25 公式一致；表19 共 103 种食物');
