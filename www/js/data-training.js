/*
 * 训练数据：动作名称、肌群分组、“选几个动作”、组数全部照抄《健身Excel超级套表》表21-24。
 * 每个肌群都记录了原表的单元格位置（组数在 C 列，可选动作在 D 列）。
 * 同一肌群里 Excel 列出的其他动作，就是这个动作的“替换备选”；肌群里只有一个动作时没有备选。
 * 动作图片来自开源图库 free-exercise-db（Unlicense 公有领域），approx:1 表示图库里没有完全一样的动作，用相近动作示意。
 */

/* 动作：[显示名, 图库ID, 器械, 多关节(依据原表 E/F 列关节活动), 不追求力竭(表21 C13), 近似示意图] */
window.EX = (() => {
  const raw = {
    pullup: ['引体向上', 'Pullups', '单杠', 1, 0],
    lat_pd: ['高位下拉', 'Wide-Grip_Lat_Pulldown', '高位下拉器', 1, 0],
    mach_pd: ['器械下拉', 'Close-Grip_Front_Lat_Pulldown', '下拉器械', 1, 0, 1],
    bb_row: ['杠铃俯身划船', 'Bent_Over_Barbell_Row', '杠铃', 1, 0],
    tbar_row: ['T杆俯身划船', 'T-Bar_Row_with_Handle', 'T杆划船架', 1, 0],
    seat_row: ['坐姿器械划船', 'Seated_Cable_Rows', '坐姿划船器', 1, 0],
    db_row: ['单边哑铃划船', 'One-Arm_Dumbbell_Row', '哑铃 + 平凳', 1, 0],
    sa_pd: ['龙门架直臂下压', 'Straight-Arm_Pulldown', '龙门架', 0, 0],
    db_rfly: ['哑铃俯身飞鸟', 'Seated_Bent-Over_Rear_Delt_Raise', '哑铃', 0, 0],
    m_rfly: ['蝴蝶机反向飞鸟', 'Reverse_Machine_Flyes', '蝴蝶机', 0, 0],
    c_rfly: ['龙门架反向飞鸟', 'Cable_Rear_Delt_Fly', '龙门架', 0, 0],
    wrow_m: ['坐姿器械划船（水平开肘）', 'Face_Pull', '坐姿划船器', 1, 0, 1],
    wrow_c: ['坐姿绳索划船（水平开肘）', 'Face_Pull', '龙门架 + 绳索', 1, 0, 1],
    db_curl: ['哑铃弯举', 'Dumbbell_Bicep_Curl', '哑铃', 0, 0],
    bb_curl: ['杠铃弯举', 'Barbell_Curl', '杠铃', 0, 0],
    conc_curl: ['集中弯举', 'Concentration_Curls', '哑铃 + 平凳', 0, 0],
    m_curl: ['器械弯举', 'Machine_Bicep_Curl', '弯举器械', 0, 0],
    pr_curl: ['牧师椅弯举', 'Preacher_Curl', '牧师椅', 0, 0],
    bench_bb: ['杠铃卧推', 'Barbell_Bench_Press_-_Medium_Grip', '杠铃 + 卧推架', 1, 1],
    bench_db: ['哑铃卧推', 'Dumbbell_Bench_Press', '哑铃 + 平凳', 1, 1],
    bench_sm: ['史密斯卧推', 'Smith_Machine_Bench_Press', '史密斯机', 1, 1],
    m_press: ['器械推胸（水平推）', 'Machine_Bench_Press', '推胸器械', 1, 0],
    bfly: ['蝴蝶机夹胸', 'Butterfly', '蝴蝶机', 0, 0],
    cfly: ['龙门架夹胸（水平夹）', 'Cable_Crossover', '龙门架', 0, 0],
    cfly_down: ['龙门架夹胸（完全下夹）', 'Cable_Crossover', '龙门架', 0, 0, 1],
    cfly_decl: ['龙门架夹胸（下斜夹）', 'Cable_Crossover', '龙门架', 0, 0, 1],
    m_decl: ['器械推胸（下斜推）', 'Leverage_Decline_Chest_Press', '推胸器械', 1, 0],
    decl_bb: ['杠铃卧推（下斜推）', 'Decline_Barbell_Bench_Press', '杠铃 + 下斜凳', 1, 1],
    decl_db: ['哑铃卧推（下斜推）', 'Decline_Dumbbell_Bench_Press', '哑铃 + 下斜凳', 1, 1],
    decl_sm: ['史密斯卧推（下斜推）', 'Smith_Machine_Decline_Press', '史密斯机', 1, 1],
    dip: ['双杠臂屈伸（上身前趴30-60°）', 'Dips_-_Chest_Version', '双杠', 1, 0],
    inc_bb: ['杠铃卧推（上斜推）', 'Barbell_Incline_Bench_Press_-_Medium_Grip', '杠铃 + 上斜凳', 1, 1],
    inc_db: ['哑铃卧推（上斜推）', 'Incline_Dumbbell_Press', '哑铃 + 上斜凳', 1, 1],
    inc_sm: ['史密斯卧推（上斜推）', 'Smith_Machine_Incline_Bench_Press', '史密斯机', 1, 1],
    m_inc: ['器械推胸（上斜推）', 'Leverage_Incline_Chest_Press', '推胸器械', 1, 0],
    cfly_inc: ['龙门架夹胸（上斜夹）', 'Low_Cable_Crossover', '龙门架', 0, 0],
    ohp_m: ['器械推举', 'Machine_Shoulder_Military_Press', '推举器械', 1, 0],
    ohp_db: ['哑铃推举', 'Dumbbell_Shoulder_Press', '哑铃 + 靠背凳', 1, 1],
    ohp_sm: ['史密斯推举', 'Smith_Machine_Overhead_Shoulder_Press', '史密斯机', 1, 1],
    fr_bb: ['杠铃前平举', 'Front_Dumbbell_Raise', '杠铃', 0, 0, 1],
    fr_plate: ['哑铃片前平举', 'Front_Plate_Raise', '杠铃片', 0, 0],
    lat_db: ['哑铃侧平举', 'Side_Lateral_Raise', '哑铃', 0, 0],
    lat_c: ['龙门架侧平举', 'Cable_Seated_Lateral_Raise', '龙门架', 0, 0],
    upr_bb: ['杠铃提拉', 'Upright_Barbell_Row', '杠铃', 1, 0],
    pd_bar: ['龙门架直杆下压', 'Triceps_Pushdown', '龙门架 + 直杆', 0, 0],
    pd_rope: ['龙门架绳索臂屈伸', 'Triceps_Pushdown_-_Rope_Attachment', '龙门架 + 绳索', 0, 0],
    db_ohe: ['哑铃颈后臂屈伸', 'Standing_Dumbbell_Triceps_Extension', '哑铃', 0, 0],
    bb_skull: ['杠铃仰卧臂屈伸', 'Lying_Triceps_Press', '杠铃 + 平凳', 0, 0],
    cg_bb: ['杠铃窄距卧推', 'Close-Grip_Barbell_Bench_Press', '杠铃 + 卧推架', 1, 1],
    cg_db: ['哑铃窄距卧推', 'Close-Grip_Dumbbell_Press', '哑铃 + 平凳', 1, 1],
    cg_sm: ['史密斯窄距卧推', 'Close-Grip_Barbell_Bench_Press', '史密斯机', 1, 1, 1],
    squat: ['杠铃深蹲', 'Barbell_Squat', '杠铃 + 深蹲架', 1, 1],
    leg_ext: ['器械腿屈伸', 'Leg_Extensions', '腿屈伸器械', 0, 0],
    rdl: ['罗马尼亚硬拉', 'Romanian_Deadlift', '杠铃', 1, 0],
    dl: ['传统硬拉', 'Barbell_Deadlift', '杠铃', 1, 0],
    leg_curl: ['器械腿弯举', 'Lying_Leg_Curls', '腿弯举器械', 0, 0],
    hip_m: ['器械臀冲', 'Barbell_Hip_Thrust', '臀冲器械', 0, 0, 1],
    hip_bb: ['杠铃臀冲', 'Barbell_Hip_Thrust', '杠铃 + 平凳', 0, 0],
    hack: ['哈克机', 'Hack_Squat', '哈克深蹲机', 1, 0],
    leg_press: ['倒蹬机', 'Leg_Press', '倒蹬机', 1, 0],
    lunge: ['箭步蹲', 'Dumbbell_Lunges', '哑铃', 1, 0],
    sm_squat: ['史密斯深蹲', 'Smith_Machine_Squat', '史密斯机', 1, 0],
    crunch: ['平板卷腹', 'Crunches', '瑜伽垫', 0, 0],
    hang_raise: ['悬垂举腿', 'Hanging_Leg_Raise', '单杠', 0, 0],
    // 表24 居家
    pullup_band: ['引体向上（可用弹力带减重）', 'Band_Assisted_Pull-Up', '单杠 + 弹力带', 1, 0],
    band_row: ['弹力带俯身划船', 'Bent_Over_Two-Dumbbell_Row', '弹力带', 1, 0, 1],
    band_rfly: ['弹力带反向飞鸟', 'Back_Flyes_-_With_Bands', '弹力带', 0, 0],
    band_wrow: ['弹力带划船（水平开肘）', 'Band_Pull_Apart', '弹力带', 1, 0, 1],
    band_curl: ['弹力带弯举', 'Close-Grip_EZ-Bar_Curl_with_Band', '弹力带', 0, 0, 1],
    pushup: ['俯卧撑', 'Pushups', '徒手', 1, 0],
    db_bench_h: ['哑铃卧推', 'Dumbbell_Bench_Press', '哑铃（有凳更好）', 1, 1],
    band_fly: ['弹力带夹胸（水平夹）', 'Cross_Over_-_With_Bands', '弹力带', 0, 0],
    band_fly_down: ['弹力带夹胸（完全下夹）', 'Cross_Over_-_With_Bands', '弹力带', 0, 0, 1],
    band_fly_decl: ['弹力带夹胸（下斜夹）', 'Cross_Over_-_With_Bands', '弹力带', 0, 0, 1],
    pushup_hand: ['俯卧撑（手垫高10cm）', 'Incline_Push-Up', '徒手', 1, 0],
    pushup_feet: ['俯卧撑（脚垫高20cm）', 'Push-Ups_With_Feet_Elevated', '徒手', 1, 0],
    band_fly_inc: ['弹力带夹胸（上斜夹）', 'Cross_Over_-_With_Bands', '弹力带', 0, 0, 1],
    band_ohp: ['弹力带推举', 'Shoulder_Press_-_With_Bands', '弹力带', 1, 0],
    db_fr: ['哑铃前平举', 'Front_Dumbbell_Raise', '哑铃', 0, 0],
    band_fr: ['弹力带前平举', 'Front_Dumbbell_Raise', '弹力带', 0, 0, 1],
    band_lat: ['弹力带侧平举', 'Lateral_Raise_-_With_Bands', '弹力带', 0, 0],
    db_upr: ['哑铃提拉', 'Standing_Dumbbell_Upright_Row', '哑铃', 1, 0],
    band_upr: ['弹力带提拉', 'Upright_Row_-_With_Bands', '弹力带', 1, 0],
    band_ohe: ['弹力带颈后臂屈伸', 'Standing_Dumbbell_Triceps_Extension', '弹力带', 0, 0, 1],
    db_lye: ['哑铃仰卧臂屈伸', 'Lying_Dumbbell_Tricep_Extension', '哑铃 + 平凳', 0, 0],
    cg_pushup: ['窄距俯卧撑', 'Push-Ups_-_Close_Triceps_Position', '徒手', 1, 0],
    db_lunge: ['哑铃箭步蹲', 'Dumbbell_Lunges', '哑铃', 1, 0],
    goblet: ['哑铃深蹲（高脚杯深蹲）', 'Goblet_Squat', '哑铃', 1, 0],
    db_dl: ['哑铃硬拉', 'Stiff-Legged_Dumbbell_Deadlift', '哑铃', 1, 0],
    band_dl: ['弹力带硬拉', 'Deadlift_with_Bands', '弹力带', 1, 0, 1],
    band_bridge: ['弹力带臀桥', 'Butt_Lift_Bridge', '弹力带', 0, 0, 1],
    band_abd: ['弹力带髋外展', 'Thigh_Abductor', '弹力带', 0, 0, 1],
  };
  const out = {};
  for (const [k, [n, img, eq, multi, noFail, approx]] of Object.entries(raw)) {
    out[k] = { id: k, n, img, eq, multi: !!multi, noFail: !!noFail, approx: !!approx };
  }
  return out;
})();

/* 原表 D 列的一行 = 一个“条目”；形如“杠铃/哑铃/史密斯卧推”的条目展开成几个器械版本 */
window.ENTRY = {
  pullup: ['pullup'], lat_pd: ['lat_pd'], mach_pd: ['mach_pd'],
  bb_row: ['bb_row'], tbar_row: ['tbar_row'], seat_row: ['seat_row'], db_row: ['db_row'], sa_pd: ['sa_pd'],
  db_rfly: ['db_rfly'], m_rfly: ['m_rfly'], c_rfly: ['c_rfly'], wrow: ['wrow_m', 'wrow_c'],
  db_curl: ['db_curl'], bb_curl: ['bb_curl'], conc_curl: ['conc_curl'], m_curl: ['m_curl'], pr_curl: ['pr_curl'],
  bench: ['bench_bb', 'bench_db', 'bench_sm'], m_press: ['m_press'], bfly: ['bfly'], cfly: ['cfly'],
  cfly_down: ['cfly_down'], cfly_decl: ['cfly_decl'], m_decl: ['m_decl'], decl: ['decl_bb', 'decl_db', 'decl_sm'], dip: ['dip'],
  inc: ['inc_bb', 'inc_db', 'inc_sm'], m_inc: ['m_inc'], cfly_inc: ['cfly_inc'],
  ohp: ['ohp_m', 'ohp_db', 'ohp_sm'], fr: ['fr_bb', 'fr_plate'],
  lat: ['lat_db', 'lat_c'], upr_bb: ['upr_bb'],
  pd_bar: ['pd_bar'], pd_rope: ['pd_rope'], db_ohe: ['db_ohe'], bb_skull: ['bb_skull'], cg: ['cg_bb', 'cg_db', 'cg_sm'],
  squat: ['squat'], leg_ext: ['leg_ext'], dl: ['rdl', 'dl'], leg_curl: ['leg_curl'], hip_m: ['hip_m'], hip_bb: ['hip_bb'],
  hack: ['hack'], leg_press: ['leg_press'], lunge: ['lunge'], sm_squat: ['sm_squat'],
  crunch: ['crunch'], hang_raise: ['hang_raise'],
  pullup_band: ['pullup_band'], band_row: ['band_row'], band_rfly: ['band_rfly'], band_wrow: ['band_wrow'], band_curl: ['band_curl'],
  pushup: ['pushup'], db_bench_h: ['db_bench_h'], band_fly: ['band_fly'],
  band_fly_down: ['band_fly_down'], band_fly_decl: ['band_fly_decl'], pushup_hand: ['pushup_hand'],
  inc_bb: ['inc_bb'], pushup_feet: ['pushup_feet'], band_fly_inc: ['band_fly_inc'],
  h_ohp: ['ohp_db', 'band_ohp'], h_fr: ['db_fr', 'band_fr'], h_lat: ['lat_db', 'band_lat'], h_upr: ['db_upr', 'band_upr'],
  h_ohe: ['db_ohe', 'band_ohe'], db_lye: ['db_lye'], cg_pushup: ['cg_pushup'],
  db_lunge: ['db_lunge'], goblet: ['goblet'], db_dl: ['db_dl'], band_dl: ['band_dl'], band_bridge: ['band_bridge'], band_abd: ['band_abd'],
  decl_db: ['decl_db'],
};
window.ENTRY_LABEL = {
  wrow: '坐姿器械/绳索划船（水平开肘）', bench: '杠铃/哑铃/史密斯卧推（水平推）', decl: '杠铃/哑铃/史密斯卧推（下斜推）',
  inc: '杠铃/哑铃/史密斯卧推（上斜推）', ohp: '器械/哑铃/史密斯推举', fr: '杠铃/哑铃片前平举', lat: '哑铃/龙门架侧平举',
  cg: '杠铃/哑铃/史密斯窄距卧推', dl: '罗马尼亚/传统硬拉', h_ohp: '哑铃/弹力带推举', h_fr: '哑铃/弹力带前平举',
  h_lat: '哑铃/弹力带侧平举', h_upr: '哑铃/弹力带提拉', h_ohe: '哑铃/弹力带颈后臂屈伸',
};

/* 部位 → 肌群，资料页的“想练的部位”用它筛选 */
window.PARTS = [
  { id: 'chest', name: '胸', groups: ['mid_chest', 'low_chest', 'up_chest'] },
  { id: 'back', name: '背', groups: ['pull', 'row', 'back'] },
  { id: 'shoulder', name: '肩', groups: ['front', 'side', 'rear'] },
  { id: 'arm', name: '手臂', groups: ['bi', 'tri'] },
  { id: 'legs', name: '腿臀', groups: ['quad', 'ham', 'glute', 'comp'] },
  { id: 'abs', name: '腹', groups: ['abs'] },
];

/* g(肌群id, 名称, 原表文字, 选几个[min,max], 组数[min,max], 表, 组数单元格, 动作起始行, 条目, 附加) */
function g(id, name, text, pick, sets, sheet, cCell, dStart, entries, extra) {
  const col = cCell.replace(/\d+/, '');
  const rows = entries.map((e, i) => `D${dStart + i}`);
  return Object.assign({
    id, name, text, pick, sets, entries,
    src: `${sheet} ${cCell}（组数），${rows[0]}-${rows[rows.length - 1]}（动作）`, sheet, col,
  }, extra || {});
}
const NOVICE_EXTRA = { optionalNovice: true };

window.SPLITS = {
  three: {
    name: '健身房三分化', src: '表21', days: [
      { name: '背 + 肩后束 + 肱二头', src: '表21 B17', groups: [
        g('pull', '背·下拉', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C22', 22, ['pullup', 'lat_pd', 'mach_pd']),
        g('row', '背·划船', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C25', 25, ['bb_row', 'tbar_row', 'seat_row', 'db_row', 'sa_pd']),
        g('rear', '肩后束', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C30', 30, ['db_rfly', 'm_rfly', 'c_rfly', 'wrow']),
        g('bi', '肱二头', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C34', 34, ['db_curl', 'bb_curl', 'conc_curl', 'm_curl', 'pr_curl']),
      ] },
      { name: '胸 + 肩前中束 + 肱三头', src: '表21 B40', groups: [
        g('mid_chest', '中胸', '选2-3个动作 总共10组', [2, 3], [10, 10], '表21', 'C45', 45, ['bench', 'm_press', 'bfly', 'cfly']),
        g('low_chest', '下胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表21', 'C49', 49, ['cfly_down', 'cfly_decl', 'm_decl', 'decl', 'dip'], NOVICE_EXTRA),
        g('up_chest', '上胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表21', 'C54', 54, ['inc', 'm_inc', 'cfly_inc'], NOVICE_EXTRA),
        g('front', '肩前束', '选1个动作 总共5组', [1, 1], [5, 5], '表21', 'C57', 57, ['ohp', 'fr']),
        g('side', '肩中束', '选1个动作 总共5组', [1, 1], [5, 5], '表21', 'C59', 59, ['lat', 'upr_bb']),
        g('tri', '肱三头', '选1个动作 总共5组', [1, 1], [5, 5], '表21', 'C61', 61, ['pd_bar', 'pd_rope', 'db_ohe', 'bb_skull', 'cg']),
      ] },
      { name: '腿臀 + 腹', src: '表21 B67', legs: '表21 B74', groups: [
        g('quad', '股四头肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C71', 71, ['squat', 'leg_ext']),
        g('ham', '腘绳肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C73', 73, ['dl', 'leg_curl']),
        g('glute', '臀大肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C75', 75, ['hip_m', 'hip_bb']),
        g('comp', '兼练动作', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表21', 'C77', 77, ['hack', 'leg_press', 'lunge', 'sm_squat']),
        g('abs', '腹', '选1-2个动作 总共6-8组（男性要练，女性偶尔）', [1, 2], [6, 8], '表21', 'C81', 81, ['crunch', 'hang_raise']),
      ] },
    ],
  },
  four_sh: {
    name: '健身房四分化（肩单练版）', src: '表22', days: [
      { name: '背 + 肱二头', src: '表22 B17', groups: [
        g('pull', '背·下拉', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C22', 22, ['pullup', 'lat_pd', 'mach_pd']),
        g('row', '背·划船', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C25', 25, ['bb_row', 'tbar_row', 'seat_row', 'db_row', 'sa_pd']),
        g('bi', '肱二头', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C30', 30, ['db_curl', 'bb_curl', 'conc_curl', 'm_curl', 'pr_curl']),
      ] },
      { name: '胸 + 肱三头', src: '表22 B36', groups: [
        g('mid_chest', '中胸', '选2-3个动作 总共12组', [2, 3], [12, 12], '表22', 'C41', 41, ['bench', 'm_press', 'bfly', 'cfly']),
        g('low_chest', '下胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表22', 'C45', 45, ['cfly_down', 'cfly_decl', 'm_decl', 'decl', 'dip'], NOVICE_EXTRA),
        g('up_chest', '上胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表22', 'C50', 50, ['inc', 'm_inc', 'cfly_inc'], NOVICE_EXTRA),
        g('tri', '肱三头', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C53', 53, ['pd_bar', 'pd_rope', 'db_ohe', 'bb_skull', 'cg']),
      ] },
      { name: '腿臀 + 腹', src: '表22 B59', legs: '表22 B66', groups: [
        g('quad', '股四头肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C63', 63, ['squat', 'leg_ext']),
        g('ham', '腘绳肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C65', 65, ['dl', 'leg_curl']),
        g('glute', '臀大肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C67', 67, ['hip_m', 'hip_bb']),
        g('comp', '兼练动作', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表22', 'C69', 69, ['hack', 'leg_press', 'lunge', 'sm_squat']),
        g('abs', '腹', '选1-2个动作 总共6-8组（男性要练，女性偶尔）', [1, 2], [6, 8], '表22', 'C73', 73, ['crunch', 'hang_raise']),
      ] },
      { name: '肩', src: '表22 B76', groups: [
        g('front', '肩前束', '选2个动作 总共8-10组', [2, 2], [8, 10], '表22', 'C80', 80, ['ohp', 'fr']),
        g('side', '肩中束', '选1-2个动作 总共8-10组', [1, 2], [8, 10], '表22', 'C82', 82, ['lat', 'upr_bb']),
        g('rear', '肩后束', '选1-2个动作 总共8-10组', [1, 2], [8, 10], '表22', 'C84', 84, ['db_rfly', 'm_rfly', 'c_rfly', 'wrow']),
      ] },
    ],
  },
  four_arm: {
    name: '健身房四分化（手臂单练版）', src: '表23', days: [
      { name: '背 + 肩后束', src: '表23 B17', groups: [
        g('pull', '背·下拉', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C22', 22, ['pullup', 'lat_pd', 'mach_pd']),
        g('row', '背·划船', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C25', 25, ['bb_row', 'tbar_row', 'seat_row', 'db_row', 'sa_pd']),
        g('rear', '肩后束', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C30', 30, ['db_rfly', 'm_rfly', 'c_rfly', 'wrow']),
      ] },
      { name: '胸 + 肩前中束', src: '表23 B35', groups: [
        g('mid_chest', '中胸', '选2-3个动作 总共12组', [2, 3], [12, 12], '表23', 'C40', 40, ['bench', 'm_press', 'bfly', 'cfly']),
        g('low_chest', '下胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表23', 'C44', 44, ['cfly_down', 'cfly_decl', 'm_decl', 'decl', 'dip'], NOVICE_EXTRA),
        g('up_chest', '上胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表23', 'C49', 49, ['inc', 'm_inc', 'cfly_inc'], NOVICE_EXTRA),
        g('front', '肩前束', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C52', 52, ['ohp', 'fr']),
        g('side', '肩中束', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C54', 54, ['lat', 'upr_bb']),
      ] },
      { name: '腿臀', src: '表23 B57', legs: '表23 B64', groups: [
        g('quad', '股四头肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C61', 61, ['squat', 'leg_ext']),
        g('ham', '腘绳肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C63', 63, ['dl', 'leg_curl']),
        g('glute', '臀大肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C65', 65, ['hip_m', 'hip_bb']),
        g('comp', '兼练动作', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表23', 'C67', 67, ['hack', 'leg_press', 'lunge', 'sm_squat']),
      ] },
      { name: '大臂 + 腹', src: '表23 B72', groups: [
        g('bi', '肱二头', '选2个动作 总共8-10组', [2, 2], [8, 10], '表23', 'C76', 76, ['db_curl', 'bb_curl', 'conc_curl', 'm_curl', 'pr_curl']),
        g('tri', '肱三头', '选2个动作 总共8-10组', [2, 2], [8, 10], '表23', 'C81', 81, ['pd_bar', 'pd_rope', 'db_ohe', 'bb_skull', 'cg']),
        g('abs', '腹', '选1-2个动作 总共6-8组（男性要练，女性偶尔）', [1, 2], [6, 8], '表23', 'C86', 86, ['crunch', 'hang_raise']),
      ] },
    ],
  },
  home: {
    name: '居家三分化', src: '表24', days: [
      { name: '背 + 肩后束 + 肱二头', src: '表24 B21', groups: [
        Object.assign(g('back', '背', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C26', 26, ['pullup_band', 'band_row', 'db_row']), { src: '表24 C26（组数），D26、D29、D32（动作）' }),
        g('rear', '肩后束', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C33', 33, ['db_rfly', 'band_rfly', 'band_wrow']),
        g('bi', '肱二头', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C36', 36, ['db_curl', 'band_curl', 'conc_curl']),
      ] },
      { name: '胸 + 肩前中束 + 肱三头', src: '表24 B40', groups: [
        g('mid_chest', '中胸', '选2个动作 总共10组', [2, 2], [10, 10], '表24', 'C45', 45, ['pushup', 'db_bench_h', 'band_fly']),
        g('low_chest', '下胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表24', 'C48', 48, ['band_fly_down', 'band_fly_decl', 'decl_db', 'pushup_hand', 'dip'], NOVICE_EXTRA),
        g('up_chest', '上胸', '新手偶尔加做 选1个动作 总共4组', [1, 1], [4, 4], '表24', 'C53', 53, ['inc_bb', 'pushup_feet', 'band_fly_inc'], NOVICE_EXTRA),
        g('front', '肩前束', '选1个动作 总共5组', [1, 1], [5, 5], '表24', 'C56', 56, ['h_ohp', 'h_fr']),
        g('side', '肩中束', '选1个动作 总共5组', [1, 1], [5, 5], '表24', 'C58', 58, ['h_lat', 'h_upr']),
        g('tri', '肱三头', '选1个动作 总共5组', [1, 1], [5, 5], '表24', 'C60', 60, ['h_ohe', 'db_lye', 'cg_pushup']),
      ] },
      { name: '腿臀 + 腹', src: '表24 B64', legs: '表24 B71', groups: [
        g('quad', '股四头肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C68', 68, ['db_lunge', 'goblet']),
        g('ham', '腘绳肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C70', 70, ['db_dl', 'band_dl']),
        g('glute', '臀大肌', '选1-2个动作 总共6-8组', [1, 2], [6, 8], '表24', 'C72', 72, ['band_bridge', 'band_abd']),
        g('abs', '腹', '选1-2个动作 总共6-8组（男性要练，女性偶尔）', [1, 2], [6, 8], '表24', 'C74', 74, ['crunch', 'hang_raise']),
      ] },
    ],
  },
};
