import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/algorithms.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { ddaLine, bresenhamLine, midpointCircle, transformShape, cohenSutherland, validateNumericInputs } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const coord = (points) => points.map(({ x, y }) => `${x},${y}`);

test('DDA handles steep, negative, reversed, and degenerate segments', () => {
  assert.deepEqual(coord(ddaLine({x:0,y:0},{x:2,y:5}).pixels), ['0,0','0,1','1,2','1,3','2,4','2,5']);
  assert.deepEqual(coord(ddaLine({x:-3,y:2},{x:0,y:-2}).pixels), ['-3,2','-2,1','-1,0','-1,-1','0,-2']);
  assert.deepEqual(coord(ddaLine({x:3,y:1},{x:-1,y:1}).pixels), ['3,1','2,1','1,1','0,1','-1,1']);
  assert.deepEqual(coord(ddaLine({x:2,y:-4},{x:2,y:-4}).pixels), ['2,-4']);
  assert.match(ddaLine({x:0.5,y:0},{x:3,y:1}).error, /integers/);
  assert.match(ddaLine({x:0,y:0},{x:10001,y:0}).error, /10,000-pixel/);
  assert.match(ddaLine({x:Number.MAX_SAFE_INTEGER+1,y:0},{x:0,y:0}).error, /safe integers/);
});

test('Bresenham handles all octants, reversed endpoints, and a single point', () => {
  assert.deepEqual(coord(bresenhamLine({x:-2,y:-1},{x:2,y:4}).pixels), ['-2,-1','-1,0','0,1','0,2','1,3','2,4']);
  assert.deepEqual(coord(bresenhamLine({x:4,y:-2},{x:-1,y:1}).pixels), ['4,-2','3,-1','2,-1','1,0','0,0','-1,1']);
  assert.deepEqual(coord(bresenhamLine({x:1,y:1},{x:1,y:1}).pixels), ['1,1']);
  assert.ok(bresenhamLine({x:0,y:0},{x:1.2,y:4}).error);
});

test('midpoint circle emits symmetric pixels and validates radius', () => {
  const trace=midpointCircle({x:-2,y:3},4);
  assert.ok(trace.pixels.some(p=>p.x===2&&p.y===3));
  assert.ok(trace.pixels.some(p=>p.x===-6&&p.y===3));
  assert.ok(trace.pixels.some(p=>p.x===-2&&p.y===7));
  assert.ok(trace.steps.length>0);
  assert.equal(midpointCircle({x:0,y:0},0).pixels.length,1);
  assert.ok(midpointCircle({x:0,y:0},-1).error);
  assert.match(midpointCircle({x:0,y:0},10001).error, /10,000-pixel/);
});

test('homogeneous transformations preserve expected vertices and reject invalid values', () => {
  const translated=transformShape('triangle','translation',[2,-3]);
  assert.deepEqual(translated.transformed[0],{x:-1,y:-5});
  const quarter=transformShape('triangle','rotation',[90]);
  assert.ok(Math.abs(quarter.transformed[0].x-2)<1e-9);
  assert.ok(Math.abs(quarter.transformed[0].y+3)<1e-9);
  assert.deepEqual(transformShape('rectangle','scaling',[0,2]).transformed[0],{x:0,y:-4});
  assert.deepEqual(transformShape('triangle','reflection',[1]).transformed[0],{x:3,y:-2});
  assert.deepEqual(transformShape('triangle','reflection',[2]).transformed[0],{x:3,y:2});
  assert.ok(transformShape('triangle','translation',[NaN,0]).error);
});

test('Cohen–Sutherland accepts, rejects, clips, and validates windows', () => {
  const window={xmin:-2,ymin:-2,xmax:2,ymax:2};
  assert.equal(cohenSutherland({x:-1,y:0},{x:1,y:1},window).result.status,'accepted');
  assert.equal(cohenSutherland({x:-5,y:4},{x:5,y:4},window).result.status,'rejected');
  const clipped=cohenSutherland({x:-5,y:0},{x:5,y:0},window);
  assert.equal(clipped.result.status,'accepted');
  assert.deepEqual(clipped.result.a,{x:-2,y:0});
  assert.deepEqual(clipped.result.b,{x:2,y:0});
  assert.ok(clipped.steps.some(s=>s.title.startsWith('Intersect')));
  assert.ok(cohenSutherland({x:0,y:0},{x:1,y:1},{xmin:2,ymin:0,xmax:1,ymax:3}).error);
  assert.equal(cohenSutherland({x:0,y:0},{x:1,y:1},{xmin:0,ymin:0,xmax:1,ymax:1}).result.status,'accepted');
});

test('raw form validation rejects missing, non-finite, and fractional raster inputs', () => {
  assert.match(validateNumericInputs({x1:'',y1:'0',x2:'2',y2:'1'},['x1','y1','x2','y2'],['x1','y1','x2','y2']), /Start x is required/);
  assert.match(validateNumericInputs({x1:'NaN',y1:'0'},['x1','y1']), /finite number/);
  assert.match(validateNumericInputs({radius:'2.5'},['radius'],['radius']), /integer/);
  assert.equal(validateNumericInputs({angle:'-27.5',sx:'0.4'},['angle','sx']),undefined);
  assert.equal(validateNumericInputs({x1:'-2.25',y1:'0.5',x2:'3',y2:'4'},['x1','y1','x2','y2']),undefined);
});

test('paired comparison traces retain the same requested endpoints and independent iteration records', () => {
  const start={x:-5,y:3},end={x:2,y:-4};
  const dda=ddaLine(start,end),bres=bresenhamLine(start,end);
  assert.deepEqual(dda.pixels[0],start);
  assert.deepEqual(dda.pixels.at(-1),end);
  assert.deepEqual(bres.pixels[0],start);
  assert.deepEqual(bres.pixels.at(-1),end);
  assert.ok(dda.steps[2].formula.includes('xᵢ₊₁'));
  assert.ok(bres.steps[2].formula.includes('2ε'));
  assert.notEqual(dda.steps[2].values,bres.steps[2].values);
});
