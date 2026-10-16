import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Pause, Play, RotateCcw, ScanLine, SkipForward, Sparkles } from 'lucide-react';
import { bresenhamLine, cohenSutherland, ddaLine, liangBarsky, midpointCircle, transformShape, validateNumericInputs, type ClipBoundary, type ClipWindow, type Point, type Step, type Trace } from './lib/algorithms';

type Mode = 'dda'|'bresenham'|'circle'|'translation'|'rotation'|'scaling'|'reflection'|'clipping'|'liang-barsky';
const lineNames:Record<Mode,string>={dda:'DDA line',bresenham:'Bresenham line',circle:'Midpoint circle',translation:'2D translation',rotation:'2D rotation',scaling:'2D scaling',reflection:'2D reflection',clipping:'Cohen–Sutherland', 'liang-barsky':'Liang–Barsky clipping'};
const startValues:Record<string,string>={x1:'-8',y1:'-4',x2:'7',y2:'5',cx:'1',cy:'0',radius:'7',tx:'3',ty:'2',angle:'35',sx:'1.4',sy:'0.8',axis:'0',xmin:'-5',ymin:'-3',xmax:'5',ymax:'4'};
const emptyTrace:Trace={steps:[],pixels:[]};
const liangExamples = {
  accepted: { x1: '-2', y1: '0', x2: '3', y2: '2' },
  rejected: { x1: '-8', y1: '5', x2: '8', y2: '7' },
  partial: { x1: '-8', y1: '-1', x2: '8', y2: '3' },
};
const asPoint=(values:Record<string,string>,x:string,y:string):Point=>({x:Number(values[x]),y:Number(values[y])});

type PlotProps={
  title:string; pixels:Point[]; active:Point[]; color:'cyan'|'purple';
  line?:{a:Point;b:Point;segment?:{a:Point;b:Point};segmentColor?:string};
  circle?:{center:Point;radius:number};
  original?:Point[]; transformed?:Point[];
  window?:ClipWindow;
  activeBoundary?:ClipBoundary;
  intersections?:Point[];
};

function CoordinatePlot({title,pixels,active,color,line,circle,original,transformed,window,activeBoundary,intersections}:PlotProps) {
  const [size,setSize]=useState({width:800,height:560});
  useEffect(()=>{
    const svg=document.querySelector<SVGSVGElement>(`[data-plot="${title}"]`);
    if(!svg)return;
    const resize=()=>{const width=svg.clientWidth,height=svg.clientHeight;if(width&&height)setSize({width,height});};
    resize();
    const observer=new ResizeObserver(resize);observer.observe(svg);
    return()=>observer.disconnect();
  },[title]);
  const validLine=line&&[line.a.x,line.a.y,line.b.x,line.b.y,...(line.segment?[line.segment.a.x,line.segment.a.y,line.segment.b.x,line.segment.b.y]:[])].every(Number.isFinite)?line:undefined;
  const validCircle=circle&&[circle.center.x,circle.center.y,circle.radius].every(Number.isFinite)&&circle.radius>=0?circle:undefined;
  const validWindow=window&&[window.xmin,window.ymin,window.xmax,window.ymax].every(Number.isFinite)&&window.xmin<window.xmax&&window.ymin<window.ymax?window:undefined;
  const pointsForBounds=[...pixels,...active,...(validLine?[validLine.a,validLine.b,...(validLine.segment?[validLine.segment.a,validLine.segment.b]:[])]:[]),...(validCircle?[{x:validCircle.center.x-validCircle.radius,y:validCircle.center.y-validCircle.radius},{x:validCircle.center.x+validCircle.radius,y:validCircle.center.y+validCircle.radius}]:[]),...(original??[]),...(transformed??[]),...(validWindow?[{x:validWindow.xmin,y:validWindow.ymin},{x:validWindow.xmax,y:validWindow.ymax}]:[])].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  let rangeX=Math.max(5,Math.ceil(Math.max(...pointsForBounds.map(p=>Math.abs(p.x)),0)+1));
  let rangeY=Math.max(5,Math.ceil(Math.max(...pointsForBounds.map(p=>Math.abs(p.y)),0)+1));
  const usableWidth=Math.max(1,size.width-48),usableHeight=Math.max(1,size.height-48);
  if(usableHeight/usableWidth>rangeY/rangeX)rangeY=Math.ceil(rangeX*usableHeight/usableWidth);
  else rangeX=Math.ceil(rangeY*usableWidth/usableHeight);
  const centerX=size.width/2,centerY=size.height/2;
  const unit=Math.max(3,Math.min((size.width-48)/(rangeX*2),(size.height-48)/(rangeY*2)));
  const map=(p:Point)=>({x:centerX+p.x*unit,y:centerY-p.y*unit});
  const activeKeys=new Set(active.map(p=>`${p.x},${p.y}`));
  const palette=color==='cyan'?{fill:'#55d9e8',soft:'#55d9e82a',stroke:'#8debf2',text:'#102027'}:{fill:'#b59aff',soft:'#b59aff30',stroke:'#d5c6ff',text:'#21183a'};
  const gridStep=Math.max(1,Math.ceil(Math.max(rangeX,rangeY)/18));
  const grid:ReactNode[]=[];
  for(let x=-rangeX;x<=rangeX;x+=gridStep)grid.push(<line key={`gx${x}`} x1={centerX+x*unit} y1="0" x2={centerX+x*unit} y2={size.height} stroke={x===0?'#65717e':'#28313b'} strokeWidth={x===0?1.5:.7}/>);
  for(let y=-rangeY;y<=rangeY;y+=gridStep)grid.push(<line key={`gy${y}`} x1="0" y1={centerY-y*unit} x2={size.width} y2={centerY-y*unit} stroke={y===0?'#65717e':'#28313b'} strokeWidth={y===0?1.5:.7}/>);
  const textSize=Math.max(7,Math.min(10,unit*.42));
  const axisLabels:ReactNode[]=[];
  for(let x=-rangeX;x<=rangeX;x+=gridStep)if(x!==0)axisLabels.push(<text key={`lx${x}`} x={centerX+x*unit} y={centerY+textSize+3} textAnchor="middle" fill="#778492" fontSize={textSize} fontFamily="DM Mono">{x}</text>);
  for(let y=-rangeY;y<=rangeY;y+=gridStep)if(y!==0)axisLabels.push(<text key={`ly${y}`} x={centerX-textSize-4} y={centerY-y*unit+textSize/3} textAnchor="end" fill="#778492" fontSize={textSize} fontFamily="DM Mono">{y}</text>);
  const polygon=(points:Point[])=>points.map(map).map(p=>`${p.x},${p.y}`).join(' ');
  const polygonPath=(points:Point[])=>`${points.map((point,index)=>{const p=map(point);return `${index?'L':'M'} ${p.x} ${p.y}`;}).join(' ')} Z`;
  const boundaryLine=validWindow&&activeBoundary?{
    left:{x1:centerX+validWindow.xmin*unit,y1:centerY-validWindow.ymax*unit,x2:centerX+validWindow.xmin*unit,y2:centerY-validWindow.ymin*unit},
    right:{x1:centerX+validWindow.xmax*unit,y1:centerY-validWindow.ymax*unit,x2:centerX+validWindow.xmax*unit,y2:centerY-validWindow.ymin*unit},
    bottom:{x1:centerX+validWindow.xmin*unit,y1:centerY-validWindow.ymin*unit,x2:centerX+validWindow.xmax*unit,y2:centerY-validWindow.ymin*unit},
    top:{x1:centerX+validWindow.xmin*unit,y1:centerY-validWindow.ymax*unit,x2:centerX+validWindow.xmax*unit,y2:centerY-validWindow.ymax*unit},
  }[activeBoundary]:undefined;
  return <svg data-plot={title} className="coordinate-plot" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" role="img" aria-label={`${title} signed coordinate grid`}>
    <rect width={size.width} height={size.height} fill="#12171d"/>{grid}{axisLabels}
    <text x={size.width-12} y={centerY-8} fill="#758391" fontSize="10" textAnchor="end" fontFamily="DM Mono">x</text><text x={centerX+8} y="15" fill="#758391" fontSize="10" fontFamily="DM Mono">y</text>
    {validWindow&&<rect x={centerX+validWindow.xmin*unit} y={centerY-validWindow.ymax*unit} width={(validWindow.xmax-validWindow.xmin)*unit} height={(validWindow.ymax-validWindow.ymin)*unit} fill="#b59aff10" stroke="#b59aff" strokeDasharray="5 4" strokeWidth="1.5"/>}
    {boundaryLine&&<line {...boundaryLine} className="clip-boundary-highlight" stroke="#a3e7b1" strokeWidth="4" strokeLinecap="round"/>}
    {validLine&&<><line x1={map(validLine.a).x} y1={map(validLine.a).y} x2={map(validLine.b).x} y2={map(validLine.b).y} stroke={color==='cyan'?'#55d9e855':'#b59aff66'} strokeWidth="2" strokeDasharray="5 6"/>{validLine.segment&&<line x1={map(validLine.segment.a).x} y1={map(validLine.segment.a).y} x2={map(validLine.segment.b).x} y2={map(validLine.segment.b).y} stroke={validLine.segmentColor??'#55d9e8'} strokeWidth="3"/>}<circle cx={map(validLine.a).x} cy={map(validLine.a).y} r="4" fill="#f2c879"/><circle cx={map(validLine.b).x} cy={map(validLine.b).y} r="4" fill="#b59aff"/></>}
    {intersections?.map((point,index)=>{const p=map(point);return <g key={`intersection-${index}`} className="intersection-marker"><circle cx={p.x} cy={p.y} r="7" fill="#f2c879" stroke="#fff1c3" strokeWidth="1.5"/><circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#f2c879" strokeWidth="1"/></g>})}
    {validCircle&&<circle cx={map(validCircle.center).x} cy={map(validCircle.center).y} r={validCircle.radius*unit} fill="none" stroke="#b59aff77" strokeDasharray="5 5" strokeWidth="2"/>}
    {original&&original.length>0&&<polygon points={polygon(original)} fill="#8793a115" stroke="#8b98a5" strokeWidth="2" strokeDasharray="6 5"/>}
    {transformed&&transformed.length>0&&<><motion.path key={`transform-${transformed.length}`} d={polygonPath(transformed)} initial={false} animate={{d:polygonPath(transformed)}} transition={{duration:.32,ease:'easeInOut'}} fill="#55d9e81a" stroke="#55d9e8" strokeWidth="2.5"/>{transformed.map((point,i)=>{const p=map(point);return <motion.circle key={i} cx={p.x} cy={p.y} animate={{cx:p.x,cy:p.y}} transition={{duration:.32,ease:'easeInOut'}} r="4" fill="#55d9e8" stroke="#d7fbff" strokeWidth="1"/>})}</>}
    {pixels.map((point,i)=>{const p=map(point),isActive=activeKeys.has(`${point.x},${point.y}`);return <g key={`${point.x},${point.y}-${i}`} className={`raster-pixel${isActive?' is-active':''}`}><rect x={p.x-unit*.37} y={p.y-unit*.37} width={unit*.74} height={unit*.74} rx={Math.min(4,unit*.1)} fill={isActive?palette.fill:palette.soft} stroke={isActive?palette.stroke:palette.fill} strokeWidth={isActive?1.4:.8}/>{isActive&&<circle cx={p.x} cy={p.y} r={Math.max(5,unit*.48)} fill="none" stroke="#e8edf3" strokeWidth="1.2"/>}</g>})}
  </svg>;
}

function App() {
  const [mode,setMode]=useState<Mode>('dda');
  const [values,setValues]=useState(startValues);
  const [shape,setShape]=useState<'triangle'|'rectangle'>('triangle');
  const [trace,setTrace]=useState<Trace>(()=>ddaLine({x:-8,y:-4},{x:7,y:5}));
  const [stepIndex,setStepIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState('650');
  const transformOperation=mode==='translation'?'translation':mode==='rotation'?'rotation':mode==='scaling'?'scaling':'reflection';
  const transformKeys=mode==='translation'?['tx','ty']:mode==='rotation'?['angle']:mode==='scaling'?['sx','sy']:['axis'];
  const transformValidation=validateNumericInputs(values,transformKeys,mode==='reflection'?['axis']:[]);
  const transform=useMemo(()=>{
    if(transformValidation)return{...transformShape(shape,transformOperation,[Number.NaN]),error:transformValidation};
    return transformShape(shape,transformOperation,mode==='translation'?[Number(values.tx),Number(values.ty)]:mode==='rotation'?[Number(values.angle)]:mode==='scaling'?[Number(values.sx),Number(values.sy)]:[Number(values.axis)]);
  },[shape,transformOperation,transformValidation,values,mode]);
  const stepCount=trace.steps.length;
  const current=trace.steps[Math.min(stepIndex,Math.max(0,trace.steps.length-1))];
  const visiblePixels=useMemo(()=>{
    const points:Point[]=[];
    const seen=new Set<string>();
    for(const step of trace.steps.slice(0,stepIndex+1))for(const point of step.pixels??(step.pixel?[step.pixel]:[])){
      const key=`${point.x},${point.y}`;
      if(!seen.has(key)){seen.add(key);points.push(point);}
    }
    return points;
  },[trace,stepIndex]);

  function update(key:string,value:string){setValues(prev=>({...prev,[key]:value}));setPlaying(false);setStepIndex(0);setTrace(emptyTrace);}
  function chooseLiangExample(example:keyof typeof liangExamples){
    setValues(prev=>({...prev,...liangExamples[example]}));
    setPlaying(false);
    setStepIndex(0);
    setTrace(emptyTrace);
  }
  function validateMode():string|undefined {
    if(mode==='dda'||mode==='bresenham')return validateNumericInputs(values,['x1','y1','x2','y2'],['x1','y1','x2','y2']);
    if(mode==='circle')return validateNumericInputs(values,['cx','cy','radius'],['cx','cy','radius']);
    if(mode==='clipping'||mode==='liang-barsky')return validateNumericInputs(values,['x1','y1','x2','y2','xmin','ymin','xmax','ymax']);
    return transformValidation;
  }
  function visualize(){
    setPlaying(false);setStepIndex(0);
    const validationError=validateMode();
    if(validationError){setTrace({...emptyTrace,error:validationError});return;}
    const a=asPoint(values,'x1','y1'),b=asPoint(values,'x2','y2');
    if(mode==='dda')setTrace(ddaLine(a,b));
    else if(mode==='bresenham')setTrace(bresenhamLine(a,b));
    else if(mode==='circle')setTrace(midpointCircle(asPoint(values,'cx','cy'),Number(values.radius)));
    else if(mode==='clipping')setTrace(cohenSutherland(a,b,{xmin:Number(values.xmin),ymin:Number(values.ymin),xmax:Number(values.xmax),ymax:Number(values.ymax)}));
    else if(mode==='liang-barsky')setTrace(liangBarsky(a,b,{xmin:Number(values.xmin),ymin:Number(values.ymin),xmax:Number(values.xmax),ymax:Number(values.ymax)}));
    else if(transform.error)setTrace({...emptyTrace,error:transform.error});
    else{
      const steps:Step[]=Array.from({length:13},(_,index)=>{
        const progress=index/12;
        const points=transform.points.map((point,i)=>({x:point.x+(transform.transformed[i].x-point.x)*progress,y:point.y+(transform.transformed[i].y-point.y)*progress}));
        return{
          transformProgress:progress,
          title:progress===1?'Transformation complete':'Interpolate shape vertices',
          purpose:'Move each vertex smoothly from its original coordinate to the matrix-transformed coordinate.',
          formula:transform.matrix.map(r=>`[ ${r.map(v=>v.toFixed(2)).join('   ')} ]`).join('\n'),
          iteration:`${index+1} / 13`,
          values:points.map(p=>`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join('   '),
          state:`Transform progress ${(progress*100).toFixed(0)}%`,
        };
      });
      setTrace({steps,pixels:[]});
    }
  }
  useEffect(()=>{const timer=playing?window.setInterval(()=>setStepIndex(i=>{if(i>=stepCount-1){setPlaying(false);return i;}return i+1;}),Number(speed)):undefined;return()=>{if(timer)window.clearInterval(timer);};},[playing,speed,stepCount]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.code==='Space'){e.preventDefault();setPlaying(p=>!p);}if(e.code==='ArrowRight')setStepIndex(i=>Math.min(i+1,stepCount-1));};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[stepCount]);

  function inputField(label:string,key:string,step='1'){return <label className="input-block"><span className="field-label">{label}</span><input data-testid={`input-${key}`} className="field" type="number" step={step} value={values[key]} onChange={e=>update(key,e.target.value)}/></label>;}
  function endpointFields(){return <div className="field-grid">{inputField('Start x','x1')}{inputField('Start y','y1')}{inputField('End x','x2')}{inputField('End y','y2')}</div>;}
  function renderInputs(){
    if(mode==='dda'||mode==='bresenham')return endpointFields();
    if(mode==='circle')return <div className="field-grid">{inputField('Center x','cx')}{inputField('Center y','cy')}{inputField('Radius','radius')}</div>;
    if(mode==='clipping'||mode==='liang-barsky')return <>
      {endpointFields()}
      <div className="eyebrow" style={{margin:'6px 0 10px'}}>Clipping window</div>
      <div className="field-grid">{inputField('X min','xmin','any')}{inputField('Y min','ymin','any')}{inputField('X max','xmax','any')}{inputField('Y max','ymax','any')}</div>
      {mode==='liang-barsky'&&<div className="clip-examples" aria-label="Liang–Barsky line examples">
        <span className="field-label">Try an example</span>
        <div className="clip-example-buttons">
          <button type="button" data-testid="example-liang-accepted" onClick={()=>chooseLiangExample('accepted')}>Accepted</button>
          <button type="button" data-testid="example-liang-rejected" onClick={()=>chooseLiangExample('rejected')}>Rejected</button>
          <button type="button" data-testid="example-liang-partial" onClick={()=>chooseLiangExample('partial')}>Partially clipped</button>
        </div>
      </div>}
    </>;
    return <><span className="field-label">Object geometry</span><div className="shape-select">{(['triangle','rectangle'] as const).map(s=><button key={s} data-testid={`shape-${s}`} className={`shape-chip ${shape===s?'selected':''}`} onClick={()=>setShape(s)}>{s}</button>)}</div>{mode==='translation'&&<div className="field-grid">{inputField('Δ x','tx','any')}{inputField('Δ y','ty','any')}</div>}{mode==='rotation'&&inputField('Angle · degrees','angle','any')}{mode==='scaling'&&<div className="field-grid">{inputField('Scale x','sx','any')}{inputField('Scale y','sy','any')}</div>}{mode==='reflection'&&<label className="input-block"><span className="field-label">Reflect across</span><select data-testid="input-axis" className="field" value={values.axis} onChange={e=>update('axis',e.target.value)}><option value="0">X axis</option><option value="1">Y axis</option><option value="2">Origin</option></select></label>}</>;
  }

  const purposeByMode:Record<Mode,string>={dda:'Rasterize a segment by taking evenly spaced samples along its major axis.',bresenham:'Choose the nearest raster cell using integer error accumulation.',circle:'Construct one octant, then reflect each point to complete the circle.',translation:'Move each vertex by the same displacement vector.',rotation:'Rotate every vertex around the origin using sine and cosine.',scaling:'Resize the object independently along the coordinate axes.',reflection:'Mirror each vertex over the selected axis or origin.',clipping:'Classify endpoints with four region bits, then clip or reject the segment.','liang-barsky':'Test four window boundaries using parametric inequalities to find the visible segment.'};
  const formulaByMode:Record<Mode,string>={dda:'m = max(|Δx|, |Δy|)\nxstep = Δx / m; ystep = Δy / m',bresenham:'ε₀ = Δx − Δy\n2ε decides the next integer move',circle:'p₀ = 1 − r\nReflect (±x, ±y) and (±y, ±x)',translation:'T = [1  0  tx]\n    [0  1  ty]\n    [0  0   1]',rotation:'R(θ) = [ cosθ  −sinθ  0 ]\n       [ sinθ   cosθ  0 ]\n       [  0       0   1 ]',scaling:'S = [ sx  0  0 ]\n    [  0 sy  0 ]\n    [  0  0  1 ]',reflection:'Mirror a coordinate by changing its sign.',clipping:'Outcode: top | bottom | right | left\nOR=0 → accept · AND≠0 → reject','liang-barsky':'pᵢ = {−Δx, Δx, −Δy, Δy}\nqᵢ = distance from the start point to each boundary'};
  const originalPolygon=['translation','rotation','scaling','reflection'].includes(mode);
  const rawA=asPoint(values,'x1','y1'),rawB=asPoint(values,'x2','y2');
  const clippingResult=trace.result as {status?:string}|undefined;
  const clipCandidate={xmin:Number(values.xmin),ymin:Number(values.ymin),xmax:Number(values.xmax),ymax:Number(values.ymax)};
  const clipWindow=(mode==='clipping'||mode==='liang-barsky')&&Object.values(clipCandidate).every(Number.isFinite)&&clipCandidate.xmin<clipCandidate.xmax&&clipCandidate.ymin<clipCandidate.ymax?clipCandidate:undefined;
  const activeNormal=current?.pixels??(current?.pixel?[current.pixel]:[]);
  const transformedAtStep=current?.transformProgress===undefined?transform.transformed:transform.points.map((point,i)=>({x:point.x+(transform.transformed[i].x-point.x)*current.transformProgress!,y:point.y+(transform.transformed[i].y-point.y)*current.transformProgress!}));
  const currentModeTitle=lineNames[mode];

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><span>pixel<span style={{color:'var(--cyan)'}}>lab</span></span><span className="eyebrow brand-descriptor" style={{borderLeft:'1px solid var(--line)',paddingLeft:12,marginLeft:2}}>graphics playground</span></div><div className="top-meta"><span><i className="live-dot"/>INTERACTIVE LAB</span><span>UNIT 02 / RASTERIZATION</span></div></header>
    <div className="workspace">
      <nav className="panel left-rail" aria-label="Algorithm selector"><div className="rail-label eyebrow">Explore algorithms</div><div className="algorithm-list">
        <div className="group-label">Rasterization</div>{(['dda','bresenham','circle'] as Mode[]).map((id,i)=><button key={id} data-testid={`algorithm-${id}`} className={`algo-button ${mode===id?'active':''}`} onClick={()=>{setMode(id);setStepIndex(0);setTrace(emptyTrace);setPlaying(false);}}><span className="algo-icon">{i===0?'D':i===1?'B':'◌'}</span><span>{lineNames[id]}</span></button>)}
        <div className="group-label">Transformations</div>{(['translation','rotation','scaling','reflection'] as Mode[]).map((id,i)=><button key={id} data-testid={`algorithm-${id}`} className={`algo-button ${mode===id?'active':''}`} onClick={()=>{setMode(id);setStepIndex(0);setTrace(emptyTrace);setPlaying(false);}}><span className="algo-icon">{['T','R','S','M'][i]}</span><span>{lineNames[id]}</span></button>)}
        <div className="group-label">Line clipping</div>{(['clipping','liang-barsky'] as Mode[]).map((id,i)=><button key={id} data-testid={`algorithm-${id}`} className={`algo-button ${mode===id?'active':''}`} onClick={()=>{setMode(id);setStepIndex(0);setTrace(emptyTrace);setPlaying(false);}}><span className="algo-icon">{i?'L':'C'}</span><span>{lineNames[id]}</span></button>)}
      </div></nav>
      <section className="center-column">
        <div className="panel canvas-head"><div><div className="canvas-title">Raster workspace <span style={{color:'var(--muted)',fontWeight:400}}> / {currentModeTitle}</span></div><div className="canvas-sub">A pixel is a decision. Follow how each one is made.</div></div><span className="lesson-pill"><Activity size={12} style={{verticalAlign:'-2px',marginRight:5}}/>LIVE TRACE</span></div>
        <div key={mode} className="canvas-stage">
          <CoordinatePlot title="Raster workspace" color={mode==='clipping'||mode==='liang-barsky'?'purple':'cyan'} pixels={visiblePixels} active={activeNormal} line={['dda','bresenham','clipping','liang-barsky'].includes(mode)?{a:rawA,b:rawB,segment:current?.segment,segmentColor:current?.title==='Accepted'?'#a3e7b1':undefined}:undefined} circle={mode==='circle'?{center:asPoint(values,'cx','cy'),radius:Number(values.radius)}:undefined} original={originalPolygon?transform.points:undefined} transformed={originalPolygon?transformedAtStep:undefined} window={clipWindow} activeBoundary={current?.clipBoundary} intersections={current?.intersections}/>
          <div className="canvas-tag"><ScanLine size={12} style={{verticalAlign:'-2px',marginRight:6,color:'var(--cyan)'}}/>{mode==='circle'?'OCTANT SYMMETRY':originalPolygon?'HOMOGENEOUS SPACE':'SIGNED INTEGER GRID'}</div><div className="canvas-coords">ORIGIN (0, 0) · UNIT PIXELS</div>
        </div>
        <div className="panel playback">
          <button className="control-btn" data-testid="button-reset" title="Reset trace" onClick={()=>{setPlaying(false);setStepIndex(0);}}><RotateCcw size={15}/><span className="button-text">Reset</span></button>
          <button className="control-btn primary" data-testid="button-play" onClick={()=>setPlaying(p=>!p)} disabled={stepCount<2}>{playing?<Pause size={15}/>:<Play size={15}/>}<span className="button-text">{playing?'Pause':'Play'}</span></button>
          <button className="control-btn" data-testid="button-next" title="Next step" onClick={()=>{setPlaying(false);setStepIndex(i=>Math.min(i+1,Math.max(0,stepCount-1)));}} disabled={stepIndex>=stepCount-1}><SkipForward size={15}/><span className="button-text">Next</span></button>
          <span className="step-count" data-testid="text-step-count">{stepCount?`${Math.min(stepIndex+1,stepCount)} / ${stepCount}`:'0 / 0'}</span><div className="step-progress"><span style={{width:stepCount?`${((stepIndex+1)/stepCount)*100}%`:'0%'}}/></div>
          <label className="eyebrow" htmlFor="speed-control">Speed</label><select id="speed-control" data-testid="select-speed" className="speed-select" value={speed} onChange={e=>setSpeed(e.target.value)}><option value="1100">0.5×</option><option value="650">1×</option><option value="250">2×</option></select>
        </div><div className="canvas-foot">SPACE PLAY/PAUSE <span style={{padding:'0 8px'}}>·</span> → NEXT STEP <span style={{padding:'0 8px'}}>·</span> GRID AUTO-FIT</div>
      </section>
      <aside key={mode} className="panel right-panel mode-panel">
        <div className="lesson-head"><div><div className="eyebrow">Concept module 02</div><h2 data-testid="text-algorithm-title">{lineNames[mode]}</h2></div><span className="lesson-pill">{mode==='clipping'||mode==='liang-barsky'?'CLIPPING':'RASTER'}</span></div>
        <p className="lesson-copy">{purposeByMode[mode]}</p>
        <div className="input-section">{renderInputs()}<button data-testid="button-visualize" className="control-btn primary full" onClick={visualize}><Sparkles size={14}/> Visualize trace</button></div>
        {trace.error&&<div className="error-box" role="alert" data-testid="status-validation">{trace.error}</div>}
        <hr className="section-divider"/>
        <div key={`${mode}-${stepIndex}`} className="calc-section step-refresh"><div className="calc-title"><span>Step-by-step</span><span className="eyebrow" data-testid="text-iteration">{current?.iteration??'—'}</span></div>
          <div className="calc-row"><span>Current action</span><span data-testid="text-current-state">{current?.title??'Ready to visualize'}</span></div>
          <div className="calc-row"><span>Purpose</span><span>{current?.purpose??purposeByMode[mode]}</span></div>
          <div className="calc-row"><span>Inputs</span><span className="mono">{mode==='circle'?`C(${values.cx}, ${values.cy}), r=${values.radius}`:originalPolygon?`${shape} · ${transform.points.length} vertices`:`(${values.x1}, ${values.y1}) → (${values.x2}, ${values.y2})`}</span></div>
          <div className="calc-row"><span>Iteration</span><span data-testid="text-intermediate">{current?.values??'Enter values, then run the trace.'}</span></div>
          <div className="formula" data-testid="text-formula">{current?.formula??formulaByMode[mode]}</div>
          {current&&<div className="state-box"><strong>PIXEL / STATE</strong><p data-testid="text-pixel-state">{current.state}</p></div>}
          {originalPolygon&&<><div className="calc-title" style={{marginTop:15}}>Transform matrix</div><div className="formula" data-testid="text-matrix">{transform.matrix.map(row=>`[ ${row.map(n=>Number(n.toFixed(3))).join('   ')} ]`).join('\n')}</div><div className="calc-row"><span>Original</span><span>{transform.points.map(p=>`(${p.x},${p.y})`).join(' ')}</span></div><div className="calc-row"><span>Transformed</span><span data-testid="text-transformed-coordinates">{transform.transformed.map(p=>`(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(' ')}</span></div></>}
          {mode==='clipping'&&<div className="calc-row"><span>Region codes</span><span className="mono" data-testid="text-region-codes">{(()=>{if(!clipWindow||![rawA.x,rawA.y,rawB.x,rawB.y].every(Number.isFinite))return'Enter valid line and window coordinates';const code=(p:Point)=>(p.x<clipWindow.xmin?1:0)|(p.x>clipWindow.xmax?2:0)|(p.y<clipWindow.ymin?4:0)|(p.y>clipWindow.ymax?8:0);return`${code(rawA).toString(2).padStart(4,'0')} / ${code(rawB).toString(2).padStart(4,'0')} · ${clippingResult?.status??'pending'}`;})()}</span></div>}
          {mode==='liang-barsky'&&<div className="calc-row"><span>Clip result</span><span className="mono" data-testid="text-liang-result">{clippingResult?.status??'evaluate boundaries'}</span></div>}
        </div>
      </aside>
    </div>
  </main>;
}
export default App;
