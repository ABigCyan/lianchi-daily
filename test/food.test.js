// 用法：node test/food.test.js —— 记饮食时把一句话拆成表19 的食物和分量（离线助手和“选食物”里的“直接说”都用它）
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data-tables.js', 'food-db.js']) vm.runInContext(fs.readFileSync(__dirname + '/../www/js/' + f, 'utf8'), ctx);
const F = ctx.FoodDB;
const cases = [
  // [原话, 餐次, 是否“改成”, [[表里名称, 分量 或 null（要用户补克数）], ...], 没认出的词]
  ['帮我把今天的午饭改成香蕉并且计算热量并完成', 'lunch', true, [['苹果/橙子/香蕉', 1]], []],
  ['午饭吃了一碗米饭和两个鸡蛋', 'lunch', false, [['米饭（一般）', null], ['鸡蛋', 2]], []],
  ['早饭 牛奶一盒、吐司两片、鸡蛋2个', 'breakfast', false, [['纯牛奶 250ml', 1], ['吐司切片面包', 2], ['鸡蛋', 2]], []],
  ['晚饭吃了150g米饭，200克鸡胸肉，三文鱼100g', 'dinner', false, [['米饭（一般）', 150], ['瘦肉（一般的熟肉）', 200], ['瘦肉（三文鱼/金枪鱼）', 100]], []],
  ['练后喝了30g蛋白粉', 'post', false, [['乳清蛋白粉', 30]], []],
  ['夜宵 一根香蕉 半个苹果', 'snack', false, [['苹果/橙子/香蕉', 1], ['苹果/橙子/香蕉', 0.5]], []],
  ['米饭（偏硬） 150g', null, false, [['米饭（偏硬）', 150]], []],
  ['午饭 香蕉 200g', 'lunch', false, [['香蕉', 200]], []],
  ['中午吃了黄焖鸡', 'lunch', false, [], ['黄焖鸡']],
  ['喝了 500ml 牛奶', null, false, [['纯牛奶 250ml', 2]], []],
  ['吃了一斤半西瓜', null, false, [['西瓜', 750]], []],
  ['二两牛肉', null, false, [['瘦肉（一般的熟肉）', 100]], []],
  ['两个鸡蛋', null, false, [['鸡蛋', 2]], []],
  ['十二个鸡蛋', null, false, [['鸡蛋', 12]], []],
];
let n = 0;
cases.forEach(([t, meal, rep, items, unknown]) => {
  const r = F.parse(t);
  assert.strictEqual(r.meal, meal, t + ' 餐次');
  assert.strictEqual(r.replace, rep, t + ' 改成');
  assert.strictEqual(JSON.stringify(r.items.map(x => [x.f.n, x.amt])), JSON.stringify(items), t + " 食物");
  assert.strictEqual(JSON.stringify(r.unknown), JSON.stringify(unknown), t + " 没认出");
  r.items.forEach(x => { if (x.amt == null) assert.ok(x.ask, t + ' 要提示补克数'); });
  n++;
});
// 热量 = 碳水×4 + 蛋白质×4 + 脂肪×9，营养率按表19
const egg = F.item(F.byName('鸡蛋'), 2); assert.deepStrictEqual([egg.carbs_g, egg.protein_g, egg.fat_g, egg.kcal], [0, 12, 10, 138]);
const rice = F.item(F.byName('米饭（一般）'), 200); assert.deepStrictEqual([rice.carbs_g, rice.kcal], [60, 240]);
assert.ok(F.search('鸡胸').some(f => f.n === '瘦肉（一般的熟肉）'), '搜“鸡胸”能找到熟瘦肉');
console.log(`食物识别：${n} 句话、${F.list.length} 种食物，全部通过`);
