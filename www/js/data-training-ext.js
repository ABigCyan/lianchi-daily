/*
 * 补充动作（非套表训练计划）。套表表21-24 的动作一个不动，这里只是追加“候补”。
 * 每个动作都标明依据，分三类：
 *   excel28：套表表28《健身解剖总结》里举例过、但训练计划没列的动作（出处写到行号）
 *   nsca   ：NSCA《Exercise Technique Manual for Resistance Training》第4版收录的标准动作
 *   variant：同一关节活动的器械/握法变式，按表28 的“关节活动 → 肌肉”分类挂到对应肌群
 *   other  ：常见动作，套表没有涉及的部位（前臂、核心稳定）
 * 动作图片来自 free-exercise-db（Unlicense 公有领域），由 tools/fetch-ext-images.py 下载并压缩。
 * 自动生成计划时，套表分化只用原表动作；补充动作只在“换动作 / 动作库 / 补充分化 / 器械或伤病筛选后原表动作都不能做”时出现。
 */
(() => {
  const KIND = {
    excel28: '套表表28 举例',
    nsca: 'NSCA 动作手册',
    variant: '同类变式',
    other: '常见动作',
  };
  /* id: [显示名, 图库ID, 器械, 多关节, 不追求力竭, 依据类别, 依据说明, 挂到哪些肌群, 需要的器械(可选，'a|b' 表示任选其一), 计时动作] */
  const raw = {
    // 背 · 下拉
    cg_pd: ['窄握高位下拉', 'Close-Grip_Front_Lat_Pulldown', '高位下拉器', 1, 0, 'excel28', '表28 第57行：窄握引体/下拉练背阔肌、大圆肌（肩伸）', ['pull']],
    chinup: ['反手引体向上', 'Chin-Up', '单杠', 1, 0, 'variant', '表28 第57行：窄握引体（肩伸）', ['pull', 'back']],
    pullover: ['哑铃仰卧直臂上拉', 'Straight-Arm_Dumbbell_Pullover', '哑铃 + 平凳', 0, 0, 'excel28', '表28 第46、51行：仰卧直臂上拉（肩伸：背阔肌、下胸）', ['pull', 'back']],
    // 背 · 划船
    inc_row: ['俯卧上斜哑铃划船（胸托）', 'Dumbbell_Incline_Row', '哑铃 + 上斜凳', 1, 0, 'variant', '表28 第58、60行：划船类（肩伸/水平外展 + 肩胛后缩）；胸贴凳面，下背不受力', ['row', 'back']],
    lev_row: ['器械划船（分动）', 'Leverage_High_Row', '划船器械', 1, 0, 'variant', '表28 第58行：划船类', ['row']],
    c_row1: ['单臂坐姿绳索划船', 'Seated_One-arm_Cable_Pulley_Rows', '龙门架', 1, 0, 'variant', '表28 第58行：划船类', ['row']],
    inv_row: ['反向划船（澳式引体）', 'Inverted_Row', '单杠/史密斯低杠', 1, 0, 'variant', '表28 第58、60行：划船类，用自身体重', ['row', 'back'], ['bar|smith']],
    // 背 · 下背、斜方
    back_ext: ['山羊挺身（罗马椅背屈伸）', 'Hyperextensions_Back_Extensions', '罗马椅', 1, 0, 'nsca', 'NSCA 手册：Roman Chair Back Extension', ['lowback'], ['machine']],
    shrug_db: ['哑铃耸肩', 'Dumbbell_Shrug', '哑铃', 0, 0, 'excel28', '表28 第29、56行：耸肩（肩胛上提：上斜方肌）', ['trap']],
    shrug_bb: ['杠铃耸肩', 'Barbell_Shrug', '杠铃', 0, 0, 'variant', '表28 第29行：耸肩（肩胛上提）', ['trap']],
    // 肩
    face_pull: ['龙门架面拉', 'Face_Pull', '龙门架 + 绳索', 1, 0, 'variant', '表28 第49、60行：水平外展（肩后束、冈下肌）+ 肩胛后缩', ['rear']],
    arnold: ['阿诺德推举', 'Arnold_Dumbbell_Press', '哑铃 + 靠背凳', 1, 1, 'variant', '表28 第17、19行：推举类（肩屈 + 外展）', ['front']],
    bb_ohp: ['站姿杠铃推举', 'Standing_Military_Press', '杠铃', 1, 1, 'variant', '表28 第17行：推举类（肩屈）', ['front']],
    c_fr: ['龙门架前平举', 'Front_Cable_Raise', '龙门架', 0, 0, 'variant', '表28 第17、45行：前平举（肩屈）', ['front']],
    seat_lat: ['坐姿哑铃侧平举', 'Seated_Side_Lateral_Raise', '哑铃 + 平凳', 0, 0, 'variant', '表28 第19、47行：侧平举（肩外展）', ['side']],
    // 胸
    db_fly: ['平板哑铃飞鸟', 'Dumbbell_Flyes', '哑铃 + 平凳', 0, 0, 'variant', '表28 第22、50行：夹胸类（水平内收）', ['mid_chest']],
    inc_fly: ['上斜哑铃飞鸟', 'Incline_Dumbbell_Flyes', '哑铃 + 上斜凳', 0, 0, 'variant', '表28 第17、22行：上胸（肩屈 + 水平内收）', ['up_chest']],
    floor_press: ['哑铃地板卧推', 'Dumbbell_Floor_Press', '哑铃', 1, 1, 'variant', '表28 第22行：推胸类（水平内收）；没有凳子时用', ['mid_chest']],
    lev_press: ['器械推胸（分动）', 'Leverage_Chest_Press', '推胸器械', 1, 0, 'variant', '表28 第22行：推胸类', ['mid_chest']],
    pushup_w: ['宽距俯卧撑', 'Push-Up_Wide', '徒手', 1, 0, 'variant', '表28 第22行：推胸类', ['mid_chest']],
    // 肱二头、前臂
    hammer: ['锤式弯举', 'Hammer_Curls', '哑铃', 0, 0, 'excel28', '表28 第66行：锤式弯举（肘屈：肱桡肌）', ['bi', 'forearm']],
    rev_curl: ['反手弯举（反握）', 'Reverse_Barbell_Curl', '杠铃', 0, 0, 'excel28', '表28 第66行：反手弯举（肘屈：肱肌）', ['bi', 'forearm']],
    inc_curl: ['上斜哑铃弯举', 'Incline_Dumbbell_Curl', '哑铃 + 上斜凳', 0, 0, 'variant', '表28 第23、66行：弯举类（肘屈）', ['bi']],
    ez_curl: ['EZ 杠弯举', 'EZ-Bar_Curl', 'EZ 杠', 0, 0, 'variant', '表28 第23、66行：弯举类（肘屈）', ['bi'], ['bb']],
    c_curl: ['龙门架弯举', 'Standing_Biceps_Cable_Curl', '龙门架', 0, 0, 'variant', '表28 第23、66行：弯举类（肘屈）', ['bi']],
    c_hammer: ['龙门架绳索锤式弯举', 'Cable_Hammer_Curls_-_Rope_Attachment', '龙门架 + 绳索', 0, 0, 'variant', '表28 第66行：锤式弯举', ['bi', 'forearm']],
    wrist_up: ['坐姿哑铃腕弯举（掌心向上）', 'Seated_Dumbbell_Palms-Up_Wrist_Curl', '哑铃 + 平凳', 0, 0, 'other', '前臂屈肌（腕屈），套表未涉及', ['forearm']],
    wrist_down: ['坐姿哑铃腕弯举（掌心向下）', 'Seated_Dumbbell_Palms-Down_Wrist_Curl', '哑铃 + 平凳', 0, 0, 'other', '前臂伸肌（腕伸），套表未涉及', ['forearm']],
    // 肱三头
    c_ohe: ['龙门架绳索过顶臂屈伸', 'Cable_Rope_Overhead_Triceps_Extension', '龙门架 + 绳索', 0, 0, 'excel28', '表28 第24、67行：各种臂屈伸（肘伸）', ['tri']],
    kickback: ['哑铃俯身臂屈伸', 'Tricep_Dumbbell_Kickback', '哑铃', 0, 0, 'excel28', '表28 第67行：各种臂屈伸', ['tri']],
    dip_tri: ['双杠臂屈伸（身体直立，练三头）', 'Dips_-_Triceps_Version', '双杠', 1, 0, 'excel28', '表28 第67行：各种臂屈伸', ['tri']],
    m_tri: ['器械臂屈伸', 'Machine_Triceps_Extension', '臂屈伸器械', 0, 0, 'excel28', '表28 第67行：各种臂屈伸', ['tri']],
    bench_dip: ['凳上反屈伸', 'Bench_Dips', '平凳或椅子', 1, 0, 'excel28', '表28 第67行：各种臂屈伸', ['tri']],
    rg_pd: ['龙门架反握下压', 'Reverse_Grip_Triceps_Pushdown', '龙门架 + 直杆', 0, 0, 'excel28', '表28 第67行：各种臂屈伸', ['tri']],
    // 股四头 / 兼练
    front_squat: ['杠铃前蹲', 'Front_Barbell_Squat', '杠铃 + 深蹲架', 1, 1, 'nsca', 'NSCA 手册：Front Squat', ['quad', 'comp']],
    split_squat: ['哑铃保加利亚分腿蹲', 'Split_Squat_with_Dumbbells', '哑铃 + 平凳', 1, 0, 'nsca', 'NSCA 手册：Bulgarian Squat', ['comp', 'quad']],
    step_up: ['哑铃登阶', 'Dumbbell_Step_Ups', '哑铃 + 跳箱/台阶', 1, 0, 'nsca', 'NSCA 手册：Step-Up', ['comp', 'quad'], ['db']],
    bw_squat: ['徒手深蹲', 'Bodyweight_Squat', '徒手', 1, 0, 'variant', '表28 第27、75行：蹲类（膝伸：股四头肌）', ['quad']],
    // 腘绳
    seat_curl: ['坐姿腿弯举', 'Seated_Leg_Curl', '腿弯举器械', 0, 0, 'variant', '表28 第26、74行：腿弯举（膝屈：腘绳肌）', ['ham']],
    stand_curl: ['站姿单腿弯举', 'Standing_Leg_Curl', '腿弯举器械', 0, 0, 'variant', '表28 第26、74行：腿弯举（膝屈）', ['ham']],
    ghr: ['臀腿抬升（GHR）', 'Glute_Ham_Raise', 'GHR 架', 1, 0, 'nsca', 'NSCA 手册：Glute Ham Raise', ['ham'], ['machine']],
    sl_rdl: ['单腿罗马尼亚硬拉', 'Kettlebell_One-Legged_Deadlift', '壶铃或哑铃', 1, 0, 'nsca', 'NSCA 手册：Single-Leg Kettlebell Romanian Deadlift', ['ham'], ['kb|db']],
    ball_curl: ['瑜伽球臀桥腿弯举', 'Ball_Leg_Curl', '瑜伽球', 1, 0, 'nsca', 'NSCA 手册：Stability Ball Bridge to Curl', ['ham'], ['ball']],
    // 臀
    c_kick: ['龙门架绳索后踢', 'One-Legged_Cable_Kickback', '龙门架', 0, 0, 'excel28', '表28 第25行：龙门架绳索后踢（髋伸：臀大肌、腘绳肌）', ['glute']],
    bb_bridge: ['杠铃臀桥', 'Barbell_Glute_Bridge', '杠铃', 0, 0, 'variant', '表28 第73行：臀冲类（髋伸）', ['glute']],
    sl_bridge: ['单腿臀桥', 'Single_Leg_Glute_Bridge', '徒手', 0, 0, 'variant', '表28 第73行：臀冲类（髋伸）', ['glute']],
    bw_kick: ['跪姿后踢腿', 'Glute_Kickback', '瑜伽垫', 0, 0, 'variant', '表28 第25行：后踢（髋伸）', ['glute']],
    abd_m: ['器械髋外展', 'Thigh_Abductor', '髋外展器械', 0, 0, 'variant', '与表24 D73 弹力带髋外展同一关节活动', ['glute'], ['machine']],
    kb_swing: ['壶铃摆荡', 'One-Arm_Kettlebell_Swings', '壶铃', 1, 0, 'nsca', 'NSCA 手册：Two-Arm Kettlebell Swing（图为单臂版）', ['glute', 'ham'], ['kb']],
    // 小腿
    calf_stand: ['站姿提踵', 'Standing_Calf_Raises', '提踵器械', 0, 0, 'excel28', '表28 第28、76行：提踵（踝跖屈：腓肠肌、比目鱼肌）', ['calf'], ['machine']],
    calf_seat: ['坐姿提踵', 'Seated_Calf_Raise', '坐姿提踵器械', 0, 0, 'excel28', '表28 第28、76行：提踵；屈膝时腓肠肌放松（表28 第26行它也是屈膝肌），主要练比目鱼肌', ['calf'], ['machine']],
    calf_lp: ['倒蹬机提踵', 'Calf_Press_On_The_Leg_Press_Machine', '倒蹬机', 0, 0, 'variant', '表28 第28行：提踵', ['calf'], ['machine']],
    calf_sm: ['史密斯提踵', 'Smith_Machine_Calf_Raise', '史密斯机', 0, 0, 'variant', '表28 第28行：提踵', ['calf'], ['smith']],
    calf_db: ['哑铃单腿提踵', 'Standing_Dumbbell_Calf_Raise', '哑铃 + 台阶', 0, 0, 'variant', '表28 第28行：提踵', ['calf'], ['db']],
    // 腹 / 核心
    c_crunch: ['龙门架跪姿卷腹', 'Cable_Crunch', '龙门架 + 绳索', 0, 0, 'variant', '表21 E81：躯干屈曲（卷腹类）', ['abs']],
    m_crunch: ['器械卷腹', 'Ab_Crunch_Machine', '卷腹器械', 0, 0, 'nsca', 'NSCA 手册：Abdominal Crunch (Machine)', ['abs'], ['machine']],
    rev_crunch: ['反向卷腹', 'Reverse_Crunch', '瑜伽垫', 0, 0, 'variant', '表21 E81：躯干屈曲', ['abs']],
    bench_raise: ['平凳仰卧举腿', 'Flat_Bench_Lying_Leg_Raise', '平凳或地面', 0, 0, 'variant', '与表21 D82 悬垂举腿同类', ['abs'], []],
    ball_crunch: ['瑜伽球卷腹', 'Exercise_Ball_Crunch', '瑜伽球', 0, 0, 'nsca', 'NSCA 手册：Stability Ball Abdominal Crunch', ['abs'], ['ball']],
    ab_roller: ['健腹轮', 'Ab_Roller', '健腹轮', 0, 0, 'nsca', 'NSCA 手册：Stability Ball Rollout（同类动作）', ['abs', 'core'], ['roller']],
    plank: ['平板支撑', 'Plank', '瑜伽垫', 0, 0, 'nsca', 'NSCA 手册：Front Plank', ['core'], [], 1],
    side_plank: ['侧桥', 'Side_Bridge', '瑜伽垫', 0, 0, 'nsca', 'NSCA 手册：Side Plank', ['core'], [], 1],
    dead_bug: ['死虫', 'Dead_Bug', '瑜伽垫', 0, 0, 'other', '核心抗伸展，常见于康复和热身', ['core']],
    pallof: ['帕洛夫推', 'Pallof_Press', '龙门架', 0, 0, 'nsca', 'NSCA 手册：Pallof Press (Machine)', ['core']],
    russian: ['俄罗斯转体', 'Russian_Twist', '瑜伽垫', 0, 0, 'nsca', 'NSCA 手册：Russian Twist', ['core', 'abs']],
  };

  /* 器械：bw（徒手）永远可用 */
  const EQUIP = [['bb', '杠铃'], ['db', '哑铃'], ['bench', '训练凳'], ['cable', '龙门架/绳索'], ['machine', '固定器械'], ['smith', '史密斯机'],
    ['bar', '单杠'], ['dip', '双杠'], ['band', '弹力带'], ['kb', '壶铃'], ['ball', '瑜伽球'], ['roller', '健腹轮']];
  /* 默认器械：健身房全有；居家按表24 第8行的“稍贵版”（哑铃 + 可调节卧推凳）加弹力带和单杠（表24 的动作用到） */
  const EQUIP_DEFAULT = { gym: EQUIP.map(e => e[0]), home: ['db', 'bench', 'band', 'bar'] };
  /* 由器械文字推出需要的器械（套表原有动作用这个；补充动作写了的以写的为准） */
  function needOf(eq) {
    const n = [];
    const smith = /史密斯/.test(eq);
    if (smith) n.push('smith');
    if (/龙门架/.test(eq)) n.push('cable');
    if (/杠铃|T杆|EZ/.test(eq)) n.push('bb');
    if (/哑铃/.test(eq)) n.push('db');
    if (/凳|卧推架/.test(eq) && !/有凳更好|或椅子|或地面/.test(eq)) n.push('bench');
    if (/单杠/.test(eq) && !/史密斯/.test(eq)) n.push('bar');
    if (/双杠/.test(eq)) n.push('dip');
    if (/弹力带/.test(eq)) n.push('band');
    if (!smith && /器械|机|划船器|下拉器|牧师椅|罗马椅|GHR/.test(eq)) n.push('machine');
    return n;
  }

  /* 伤病时默认避开的动作【应用补充】：只是保守的默认，具体能不能做以医生/康复师意见为准 */
  const JOINTS = [['shoulder', '肩'], ['elbow', '肘'], ['wrist', '手腕'], ['lowback', '下背/腰'], ['knee', '膝']];
  const AVOID = {
    shoulder: ['dip', 'dip_tri', 'bench_dip', 'upr_bb', 'db_upr', 'band_upr', 'ohp_m', 'ohp_db', 'ohp_sm', 'band_ohp', 'bb_ohp', 'arnold', 'pullover', 'decl_bb', 'decl_sm', 'bench_bb'],
    elbow: ['bb_skull', 'db_lye', 'dip_tri', 'bench_dip', 'cg_bb', 'cg_sm', 'db_ohe', 'band_ohe', 'c_ohe'],
    wrist: ['pushup', 'pushup_hand', 'pushup_feet', 'cg_pushup', 'pushup_w', 'bb_curl', 'rev_curl', 'front_squat', 'wrist_up', 'wrist_down', 'ab_roller'],
    lowback: ['squat', 'front_squat', 'dl', 'rdl', 'bb_row', 'tbar_row', 'db_dl', 'band_dl', 'back_ext', 'bb_ohp', 'sl_rdl', 'kb_swing', 'ab_roller', 'hang_raise'],
    knee: ['squat', 'front_squat', 'sm_squat', 'hack', 'lunge', 'db_lunge', 'split_squat', 'step_up', 'leg_ext', 'goblet', 'bw_squat', 'ghr'],
  };

  const EX = window.EX;
  // 套表原有动作：补上需要的器械，标记来源
  Object.values(EX).forEach(ex => { ex.need = needOf(ex.eq); ex.kind = 'excel'; });
  const extIds = [];
  for (const [k, [n, img, eq, multi, noFail, kind, basis, groups, need, timed]] of Object.entries(raw)) {
    EX[k] = { id: k, n, img, eq, multi: !!multi, noFail: !!noFail, approx: k === 'kb_swing', ext: true, kind, kindName: KIND[kind], basis, groups,
      need: need || needOf(eq), timed: !!timed };
    window.ENTRY[k] = [k];
    extIds.push(k);
  }
  Object.entries(AVOID).forEach(([j, ids]) => ids.forEach(id => { const ex = EX[id]; if (ex) (ex.avoid = ex.avoid || []).push(j); }));

  /* 肌群 → 补充备选（套表分化里“换动作”时出现在“补充备选”一栏） */
  const EXT_ALTS = {};
  extIds.forEach(k => EX[k].groups.forEach(g => (EXT_ALTS[g] = EXT_ALTS[g] || []).push(k)));

  /* 套表没有单列的部位：放进对应的大部位，便于“想练的部位”筛选 */
  const NEW_GROUPS = { trap: ['back', '斜方肌'], lowback: ['back', '下背'], forearm: ['arm', '前臂'], calf: ['legs', '小腿'], core: ['abs', '核心稳定'] };
  Object.entries(NEW_GROUPS).forEach(([gid, [part]]) => { const pt = window.PARTS.find(p => p.id === part); if (pt && !pt.groups.includes(gid)) pt.groups.push(gid); });

  /* 能不能做：器械齐不齐、有没有要避开的关节 */
  function usable(ex, equip, avoid) {
    if (!ex) return false;
    if (avoid && avoid.length && (ex.avoid || []).some(j => avoid.includes(j))) return false;
    if (!equip) return true;
    return (ex.need || []).every(t => t.split('|').some(x => equip.includes(x)));
  }

  Object.assign(window, { EXT_KIND: KIND, EQUIP, EQUIP_DEFAULT, JOINTS, EXT_ALTS, EXT_IDS: extIds, NEW_GROUPS, exUsable: usable, needOf });
})();
