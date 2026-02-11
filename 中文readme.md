温哥华地块分析工具 (Vancouver Parcel Lot Analysis Tool) 实施计划

一、技术栈与项目结构





框架: React 18+，语言: TypeScript（tsconfig.json 中 strict: true），构建: Vite



地图: Mapbox GL JS，推荐通过 react-map-gl 集成（react-map-gl + mapbox-gl），并引入 mapbox-gl/dist/mapbox-gl.css



数据: 





地块：使用仓库内 property-parcel-polygons.geojson（约 53MB）。每个 Feature 的 properties 含：civic_number、streetname、site_id、geo_point_2d（lon/lat）



底图：Mapbox Streets（如 mapbox://styles/mapbox/streets-v12）



道路/巷道用于边线分类：方案 A 使用 Mapbox Tilequery API 查询 mapbox.mapbox-streets-v8 的 road 图层（需 radius、geometry=linestring），根据返回的 name、class/type 做邻近与名称匹配；方案 B 额外引入温哥华开放数据 Public streets 与 Lanes（GeoJSON），在内存中做空间查询以区分街道与巷道，名称与地块 streetname 更一致。建议优先 方案 B 做街道/巷道与名称匹配，若希望零额外数据则用 方案 A。

项目目录建议：





src/: main.tsx、App.tsx、index.css



src/components/: 地图容器、搜索栏（含历史与清除）、信息卡、调试面板



src/hooks/: 防抖、键盘导航、地图点击



src/lib/: 边线提取与分类、地块类型判定、面积计算（或使用 turf-area）



src/types/: GeoJSON 地块属性、边线类型、地块类型等 TS 类型



环境变量：VITE_MAPBOX_ACCESS_TOKEN（勿提交 .env）



二、核心逻辑：边线 (Edge) 分类

2.1 数据与几何





从 GeoJSON 的 Feature.geometry（Polygon）提取外环 coordinates[0]，将相邻顶点连成有向线段（可归一化为“从顶点 i 到 i+1”的边，避免重复反向边）。



每条边存为：{ type: EdgeType, segment: [[lon,lat],[lon,lat]], midPoint, ... }，用于后续邻近查询与可视化。

2.2 分类规则（与需求一一对应）







边线类型



判定逻辑





Frontage



靠近主街道，且该街道名称与地块地址中的街道匹配（即与 properties.streetname 归一化后一致）





Flankage



靠近次要街道（转角），街道名与地块地址不匹配





Rear Lane



靠近巷道/小路（Vancouver Lanes 或 Mapbox 中 class 如 service/lane 等）





Rear



位于 Frontage 的“对面”，且不靠近任何道路或巷道





Side



其余边：连接前/侧院（Frontage/Flankage）与后/巷（Rear/Rear Lane）的边

“靠近”：对每条边的中点（或沿边采样点）做空间查询，若在阈值距离内（如 15–30m）存在道路/巷道线段，则视为相邻。阈值可配置并在调试模式中暴露。

“对面”：Frontage 的对面边可定义为：在多边形中与 Frontage 边在 centroid 两侧、且到 Frontage 距离最大的那条边（或与 Frontage 近似平行的对边）。实现时可用 centroid + 边到 centroid 的投影关系确定“对侧”。

街道名匹配：将 properties.streetname（如 "E 2ND AV"）与道路数据的 name 做归一化后比较（去空格、统一大小写、缩写如 AV→AVENUE 等），以决定 Frontage vs Flankage。

2.3 实现顺序建议





从 Polygon 提取边列表（带中点、长度等）。



对每条边做“邻近道路/巷道”查询，得到最近要素及其名称、类型（街道 vs 巷道）。



若邻近街道且名称匹配 → Frontage；邻近街道且名称不匹配 → Flankage；邻近巷道 → Rear Lane。



识别 Frontage 的对面边：若不靠近任何道路/巷道 → Rear。



其余边标为 Side。



三、地块类型判定（按优先级）

在边线分类完成后，按下列优先级判定（满足即返回，不再检查后续）：





Corner Lot（转角地块）：存在 Frontage 且存在 Flankage。



Double Fronting（双路地块）：存在两条 Frontage，且对应两条不同街道（非巷道）。



Standard with Lane（带巷道标准）：恰 1 条 Frontage，且其对面边为 Rear Lane。



Standard without Lane（不带巷道标准）：恰 1 条 Frontage，且其对面边为 Rear。

若均不满足，可归为“未分类”并在 UI 显示。



四、功能需求与实现要点

4.1 地图与地块交互





初始视图：中心设为温哥华市中心（如 -123.12, 49.28），缩放约 12–13，底图 Mapbox Streets。



将 property-parcel-polygons.geojson 作为 GeoJSON source 加入地图（可考虑按视口或瓦片做前端裁剪/抽样以控制首屏数据量，大文件可异步加载或 Worker 解析）。



点击地块：获取该 Feature → 执行边线分类与地块类型判定 → Fly to 该地块 bounds（fitBounds）→ 高亮该地块（如 fill 颜色/描边或单独 highlight 图层）→ 显示信息卡并在图上绘制边线类型（见下）。

4.2 地址搜索与自动补全





范围：仅限温哥华；数据源即本地 GeoJSON，所有结果均在温哥华。



数据：从 GeoJSON 构建地址列表（如 civic_number + ' ' + streetname），可预先索引或首次加载时生成，供搜索过滤。



防抖：输入防抖（如 300ms）后再执行过滤/请求。



键盘：箭头上下选择、Enter 确认、Esc 关闭下拉并清选。



搜索历史：在搜索框 focus 且输入为空 时显示历史记录；历史存于 localStorage；提供“清除历史”按钮（仅在显示历史时可见）。选择某条历史或某条搜索结果时，与“点击地块”相同流程：fly to、高亮、分析、展示信息卡。

4.3 信息展示卡与边线可视化





信息卡内容：完整地址、面积（m²）、主街道名称（即 streetname）、地块类型标签（Corner Lot / Double Fronting / Standard with Lane / Standard without Lane）。



面积：由 Polygon 坐标用 Turf 的 turf-area 计算（平方米），或自写 Shoelace 公式并转换到局部投影（如 UTM）得到 m²。



边线可视化：在地图上用不同颜色的线图层区分边线类型（例如 Frontage=蓝、Flankage=橙、Rear Lane=灰、Rear=绿、Side=浅灰），可在选中地块后动态添加/更新 Line 层，数据来自上述边线分类结果（segment 坐标）。

4.4 调试模式 (Debug Mode)





提供 开关按钮（如 “Debug” 或 “开发者模式”）切换调试面板显示/隐藏。



调试内容建议：当前选中地块的经纬度（如 centroid 或 bounds）、每条边的分类结果（类型、中点、邻近道路名/类型）、可选 Raw Tilequery/空间查询结果、地块 properties 原始字段。便于验证 Frontage/Flankage/Rear Lane/Rear/Side 与地块类型逻辑。



五、数据流与架构示意

flowchart LR
  subgraph data [数据]
    GeoJSON[property-parcel-polygons.geojson]
    Streets[街道/巷道 数据]
  end
  subgraph core [核心逻辑]
    Edges[边线提取]
    Classify[边线分类]
    LotType[地块类型判定]
  end
  subgraph ui [界面]
    Map[Mapbox 地图]
    Search[地址搜索]
    Card[信息卡]
    Debug[调试面板]
  end
  GeoJSON --> Edges
  Edges --> Classify
  Streets --> Classify
  Classify --> LotType
  Map --> Edges
  Search --> Map
  LotType --> Card
  LotType --> Map
  Classify --> Debug





用户通过 地图点击 或 搜索/历史选择 选定一个地块 → 触发同一套分析流程（边线分类 → 地块类型）→ 更新地图（fly to、高亮、边线图层）与信息卡、调试信息。



六、依赖建议





react、react-dom（18+）



react-map-gl、mapbox-gl（及 @types/mapbox-gl）



turf（或 @turf/area、@turf/bbox 等）：面积、bounds、必要时做点线距离



若采用 Vancouver 开放数据：可用 fetch 加载 GeoJSON 或本地放入 public/ 再加载



七、注意事项





GeoJSON 体积：文件较大，可考虑只加载当前视野内的要素（按 bbox 过滤）、或使用 GeoJSON 瓦片/矢量瓦片，以优化首屏与交互性能。



Mapbox Token：使用 .env + VITE_MAPBOX_ACCESS_TOKEN，并在说明文档中注明用户需自备 Token。



街道名归一化：温哥华数据中 streetname 常为 “E 2ND AV” 等形式，与 Mapbox 或 Vancouver 道路名称需统一规则（缩写、方向、大小写）再比较，否则 Frontage 匹配率会受影响。



Tilequery 限流：若完全依赖 Mapbox Tilequery，注意 600 次/分钟限制；可对边线批量查询或缓存结果，或改用 Vancouver 本地街道/巷道 GeoJSON 减少请求。

以上覆盖技术栈、边线分类规则、地块类型判定、地图交互、地址搜索与历史、信息卡与边线可视化、调试模式及数据流，可直接作为开发与代码实现的依据。
