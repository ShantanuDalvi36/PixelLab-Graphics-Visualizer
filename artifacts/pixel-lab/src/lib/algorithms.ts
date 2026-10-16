export type Point = { x: number; y: number };
export type Step = { pixel?: Point; pixels?: Point[]; segment?: {a:Point;b:Point}; title: string; purpose: string; formula: string; iteration: string; values: string; state: string };
export type Trace = { steps: Step[]; pixels: Point[]; error?: string; result?: unknown };
const finite = (...v: number[]) => v.every(Number.isFinite);
const key = (p: Point) => `${p.x},${p.y}`;
const FIELD_NAMES: Record<string, string> = {
  x1: 'Start x', y1: 'Start y', x2: 'End x', y2: 'End y',
  cx: 'Center x', cy: 'Center y', radius: 'Radius',
  tx: 'Translation x', ty: 'Translation y', angle: 'Angle',
  sx: 'Scale x', sy: 'Scale y', axis: 'Reflection axis',
  xmin: 'Window x minimum', ymin: 'Window y minimum',
  xmax: 'Window x maximum', ymax: 'Window y maximum',
};

/** Validate raw form strings before converting them with Number(). */
export function validateNumericInputs(
  values: Record<string, string>,
  required: string[],
  integerFields: string[] = [],
): string | undefined {
  for (const field of required) {
    const raw = values[field];
    const name = FIELD_NAMES[field] ?? field;
    if (raw === undefined || raw.trim() === '') return `${name} is required. Enter a number before visualizing.`;
    const value = Number(raw);
    if (!Number.isFinite(value)) return `${name} must be a finite number.`;
    if (integerFields.includes(field) && !Number.isSafeInteger(value)) return `${name} must be a safe integer.`;
  }
  return undefined;
}

export function ddaLine(a: Point, b: Point): Trace {
  if (!finite(a.x,a.y,b.x,b.y) || ![a.x,a.y,b.x,b.y].every(Number.isSafeInteger)) return { steps: [], pixels: [], error: 'Coordinates must be finite safe integers.' };
  const dx=b.x-a.x, dy=b.y-a.y, count=Math.max(Math.abs(dx),Math.abs(dy));
  if(count>10000)return{steps:[],pixels:[],error:'Segment exceeds the 10,000-pixel visualization limit.'};
  if (!count) return { pixels:[a], steps:[{pixel:a,title:'Single point',purpose:'A zero-length segment occupies exactly one pixel.',formula:'x = x₀, y = y₀',iteration:'1 / 1',values:`(${a.x}, ${a.y})`,state:'Degenerate line'}] };
  const xInc=dx/count,yInc=dy/count,steps:Step[]=[],pixels:Point[]=[];
  for(let i=0;i<=count;i++){const p={x:Math.round(a.x+i*xInc),y:Math.round(a.y+i*yInc)};if(!pixels.some(q=>key(q)===key(p)))pixels.push(p);steps.push({pixel:p,title:`Sample ${i+1}`,purpose:'Advance by a constant fractional increment, then round to the nearest raster cell.',formula:`xᵢ₊₁ = xᵢ + ${xInc.toFixed(3)}\nyᵢ₊₁ = yᵢ + ${yInc.toFixed(3)}`,iteration:`${i+1} / ${count+1}`,values:`x=${(a.x+i*xInc).toFixed(3)} → ${p.x}   y=${(a.y+i*yInc).toFixed(3)} → ${p.y}`,state:`Plot pixel (${p.x}, ${p.y})`});}
  return {steps,pixels};
}

export function bresenhamLine(a: Point,b: Point): Trace {
  if(!finite(a.x,a.y,b.x,b.y)||![a.x,a.y,b.x,b.y].every(Number.isSafeInteger))return{steps:[],pixels:[],error:'Coordinates must be finite safe integers.'};
  let x=a.x,y=a.y;const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y),sx=a.x<b.x?1:-1,sy=a.y<b.y?1:-1;
  if(Math.max(dx,dy)>10000)return{steps:[],pixels:[],error:'Segment exceeds the 10,000-pixel visualization limit.'};
  let err=dx-dy;const steps:Step[]=[],pixels:Point[]=[];let i=0;
  while(true){const p={x,y};pixels.push(p);const e2=2*err;let decision='endpoint reached';if(x===b.x&&y===b.y){steps.push({pixel:p,title:`Plot ${i+1}`,purpose:'Emit the current integer pixel and stop at the requested endpoint.',formula:'ε = Δx − Δy',iteration:`${i+1}`,values:`ε=${err}; doubled ε=${e2}`,state:`Endpoint (${x}, ${y})`});break;}
     const before=err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}decision=`ε ${before} → ${err}; next (${x}, ${y})`;steps.push({pixel:p,title:`Plot ${i+1}`,purpose:'Use the doubled error to choose the next horizontal and/or vertical move without floating point.',formula:`ε = Δx − Δy = ${before}\n2ε = ${e2}; move by sign(Δx), sign(Δy)`,iteration:`${i+1}`,values:decision,state:`Plot pixel (${p.x}, ${p.y})`});i++;}
  return{steps,pixels};
}

export function midpointCircle(center:Point,radius:number):Trace{
  if(!finite(center.x,center.y,radius)||![center.x,center.y,radius].every(Number.isSafeInteger)||radius<0)return{steps:[],pixels:[],error:'Center and radius must be finite safe integers; radius cannot be negative.'};
  if(radius>10000)return{steps:[],pixels:[],error:'Radius exceeds the 10,000-pixel visualization limit.'};
  let x=0,y=radius,p=1-radius;const steps:Step[]=[],all:Point[]=[],seen=new Set<string>();let i=0;
  while(x<=y){const sym=[{x:center.x+x,y:center.y+y},{x:center.x-x,y:center.y+y},{x:center.x+x,y:center.y-y},{x:center.x-x,y:center.y-y},{x:center.x+y,y:center.y+x},{x:center.x-y,y:center.y+x},{x:center.x+y,y:center.y-x},{x:center.x-y,y:center.y-x}];for(const q of sym)if(!seen.has(key(q))){seen.add(key(q));all.push(q);}steps.push({pixels:sym,title:`Octant ${i+1}`,purpose:'Reflect one calculated point across the circle’s horizontal, vertical, and diagonal axes.',formula:`p₀ = 1 − r = ${1-radius}\nif p < 0: p ← p + 2x + 3\nelse: p ← p + 2(x − y) + 5; y ← y − 1`,iteration:`${i+1}`,values:`(x,y)=(${x},${y}); p=${p}`,state:`Eight-way symmetry plots ${sym.length} candidate pixels`});if(p<0)p+=2*x+3;else{p+=2*(x-y)+5;y--;}x++;i++;}
  return{steps,pixels:all};
}

export type Matrix = [[number,number,number],[number,number,number],[number,number,number]];
export function transformShape(shape:'triangle'|'rectangle',operation:'translation'|'rotation'|'scaling'|'reflection',values:number[]):{points:Point[];transformed:Point[];matrix:Matrix;error?:string}{
  if(!values.every(Number.isFinite))return{points:[],transformed:[],matrix:[[1,0,0],[0,1,0],[0,0,1]],error:'Transformation values must be finite numbers.'};
  const points=shape==='triangle'?[{x:-3,y:-2},{x:2,y:-2},{x:0,y:3}]:[{x:-3,y:-2},{x:2,y:-2},{x:2,y:2},{x:-3,y:2}];
  let matrix:Matrix=[[1,0,0],[0,1,0],[0,0,1]];
  if(operation==='translation'){const[tx,ty]=values;matrix=[[1,0,tx],[0,1,ty],[0,0,1]];}
  if(operation==='rotation'){const rad=values[0]*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);matrix=[[c,-s,0],[s,c,0],[0,0,1]];}
  if(operation==='scaling'){const[sx,sy]=values;matrix=[[sx,0,0],[0,sy,0],[0,0,1]];}
  if(operation==='reflection'){const axis=values[0]===1?'y':values[0]===2?'origin':'x';matrix=axis==='y'?[[-1,0,0],[0,1,0],[0,0,1]]:axis==='origin'?[[-1,0,0],[0,-1,0],[0,0,1]]:[[1,0,0],[0,-1,0],[0,0,1]];}
  return{points,transformed:points.map(p=>({x:matrix[0][0]*p.x+matrix[0][1]*p.y+matrix[0][2],y:matrix[1][0]*p.x+matrix[1][1]*p.y+matrix[1][2]})),matrix};
}

export function cohenSutherland(a:Point,b:Point,window:{xmin:number;ymin:number;xmax:number;ymax:number}):Trace{
  const {xmin,ymin,xmax,ymax}=window;
  if(!finite(a.x,a.y,b.x,b.y,xmin,ymin,xmax,ymax)||xmin>=xmax||ymin>=ymax)return{steps:[],pixels:[],error:'Use finite coordinates and a window with xmin < xmax and ymin < ymax.'};
  const code=(p:Point)=>((p.x<xmin)?1:0)|((p.x>xmax)?2:0)|((p.y<ymin)?4:0)|((p.y>ymax)?8:0);
  let p1={...a},p2={...b},c1=code(p1),c2=code(p2);const steps:Step[]=[];
  for(let i=0;i<12;i++){if((c1|c2)===0){steps.push({segment:{a:{...p1},b:{...p2}},title:'Accepted',purpose:'Both endpoints are inside; the original segment is fully visible.',formula:'code₁ OR code₂ = 0000',iteration:`${i+1}`,values:`${c1.toString(2).padStart(4,'0')} & ${c2.toString(2).padStart(4,'0')}`,state:`Accept (${p1.x}, ${p1.y}) → (${p2.x}, ${p2.y})`});return{steps,pixels:[],result:{status:'accepted',a:p1,b:p2}};}if((c1&c2)!==0){steps.push({segment:{a:{...p1},b:{...p2}},title:'Rejected',purpose:'A shared outside bit proves the segment cannot cross the clipping window.',formula:'code₁ AND code₂ ≠ 0000',iteration:`${i+1}`,values:`${c1.toString(2).padStart(4,'0')} & ${c2.toString(2).padStart(4,'0')}`,state:'Reject: segment is outside the visible window'});return{steps,pixels:[],result:{status:'rejected'}};}
    const out=c1||c2;let x=0,y=0;let edge='';if(out&8){edge='top';x=p1.x+(p2.x-p1.x)*(ymax-p1.y)/(p2.y-p1.y);y=ymax;}else if(out&4){edge='bottom';x=p1.x+(p2.x-p1.x)*(ymin-p1.y)/(p2.y-p1.y);y=ymin;}else if(out&2){edge='right';y=p1.y+(p2.y-p1.y)*(xmax-p1.x)/(p2.x-p1.x);x=xmax;}else{edge='left';y=p1.y+(p2.y-p1.y)*(xmin-p1.x)/(p2.x-p1.x);x=xmin;}
    const intersection={x:Number(x.toFixed(3)),y:Number(y.toFixed(3))};if(out===c1){p1=intersection;c1=code(p1);}else{p2=intersection;c2=code(p2);}steps.push({segment:{a:{...p1},b:{...p2}},title:`Intersect ${edge}`,purpose:'Replace one outside endpoint with its intersection on the selected window boundary.',formula:`x = x₁ + Δx · (yedge − y₁) / Δy\ny = y₁ + Δy · (xedge − x₁) / Δx`,iteration:`${i+1}`,values:`codes ${c1.toString(2).padStart(4,'0')} / ${c2.toString(2).padStart(4,'0')}; hit (${intersection.x}, ${intersection.y})`,state:`Clip against ${edge} boundary`});}
  return{steps,pixels:[],error:'Clipping did not converge; check the supplied line and window.'};
}
