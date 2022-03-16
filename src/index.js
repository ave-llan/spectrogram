import './style.css';
import * as d3Selection from "d3-selection";

const WIDTH = 100,
     HEIGHT = 100
const originalTriangle = [[5, 95], [95,95], [50, 5]]
const NUM_GENERATIONS = 16

const svg = createSvg();
drawFromTriangle(originalTriangle)

function createSvg() {
  return d3Selection.select('body').append('svg')
      .attr('width', '800px')
      .attr('height', '800px')
      .attr('viewBox', [0, 0, WIDTH, HEIGHT].join(' '));
}

function drawFromTriangle(triangle) {
  const triangles = svg.selectAll('.triangle')
    .data(propagate(triangle, NUM_GENERATIONS), trianglePathDescription)
  
  triangles.exit()
    .remove()

  triangles.enter()
    .append('g')
      .attr('class', 'triangle')
    .append('path')
      .attr('d', trianglePathDescription)
      .on('mousedown', subdivideTriangle)
}

function propagate(triangle, generations) {
  const progeny = []
  if (stayAlive(generations)) {
    divideTriangle(triangle).forEach(
      child => progeny.push(...propagate(child, generations - 1)))
  } else {
    progeny.push(triangle)
  }
  return progeny
}

function subdivideTriangle() {
  const newTriangle = scaleTriangle(d3Selection.select(this).datum(), WIDTH)
  drawFromTriangle(newTriangle)
}


// Probability of 1 in generations + 1 that triangle stops reproducing.
function stayAlive(generations) {
  return Math.round(Math.random() * generations)
}

function trianglePathDescription(t) {
  return `M${t[0]}L${t[1]}L${t[2]}z`
}

// Divides a triangle in two from the middle of the longest side.
function divideTriangle(triangle) {
  let longest = 0
  let a, b, z
  for (let _ of triangle) {
    const length = lineLength(triangle.slice(0, 2))
    if (length > longest) {
      [longest, [a, b, z]] = [length, triangle]
    }
    triangle.push(triangle.shift())
  }
  const midpoint = lineMidpoint([a, b])
  return [[a, midpoint, z], [b, midpoint, z]]
}

function lineLength(line) {
  const [[ax, ay], [bx, by]] = line
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by))
}

function lineMidpoint(line) {
  const [[ax, ay], [bx, by]] = line
  return [(ax + bx) / 2, (ay + by) / 2]
}

function scaleTriangle(triangle, fit) {
  const {width, height, minX, minY} = triangleDimensions(triangle)
  const scale = fit / Math.max(width, height)
  const [centeringX, centeringY] = [width, height]
      .map(dimension => (fit - dimension * scale) / 2)

  return triangle.map(point => 
    [(point[0] - minX) * scale + centeringX, 
     (point[1] - minY) * scale + centeringY])
}

function triangleDimensions(triangle) {
  const [xs, ys] = [0, 1].map(
    d => {
      const ds = triangle.map(point => point[d])
      ds.sort()
      return ds
    })
  return {width: xs[2] - xs[0], height: ys[2] - ys[0], minX: xs[0], minY: ys[0]}
}