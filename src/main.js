import './style.css'
import * as THREE from 'three'
// __controls_import__
// __gui_import__

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader'
import { Pane } from 'tweakpane'

/**
 * Debug
 */
// __gui__
const config = {
	example: 5,
}
const pane = new Pane()

pane
	.addBinding(config, 'example', {
		min: 0,
		max: 10,
		step: 0.1,
	})
	.on('change', (ev) => console.log(ev.value))

/**
 * Scene
 */
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xffffff)

// __box__
/**
 * BOX - custom vertex colors per face
 */
const geometry = new THREE.BoxGeometry(1, 1, 1)

// 6 faces × 4 vertices each = 24 vertices
// BoxGeometry face order: +x, -x, +y, -y, +z, -z
const faceColors = [
	new THREE.Color('red'), // +x
	new THREE.Color('blue'), // -x
	new THREE.Color('green'), // +y
	new THREE.Color('yellow'), // -y
	new THREE.Color('cyan'), // +z
	new THREE.Color('magenta'), // -z
]

const colors = new Float32Array(24 * 3)
for (let face = 0; face < 6; face++) {
	const c = faceColors[face]
	for (let v = 0; v < 4; v++) {
		const i = (face * 4 + v) * 3
		colors[i] = c.r
		colors[i + 1] = c.g
		colors[i + 2] = c.b
	}
}
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

const material = new THREE.ShaderMaterial({
	vertexShader: /* glsl */ `
		attribute vec3 color;
		varying vec3 vColor;
		void main() {
			vColor = color;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: /* glsl */ `
		varying vec3 vColor;
		void main() {
			gl_FragColor = vec4(vColor, 1.0);
		}
	`,
})

const mesh = new THREE.Mesh(geometry, material)
mesh.position.y += 0.5
scene.add(mesh)

/**
 * render sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
}

/**
 * Camera
 */
const fov = 45
const camera = new THREE.PerspectiveCamera(fov, sizes.width / sizes.height, 0.1)
camera.position.set(4, 4, 4)
camera.lookAt(new THREE.Vector3(0, 2.5, 0))

/**
 * Show the axes of coordinates system
 */
// __helper_axes__
const axesHelper = new THREE.AxesHelper(3)
// scene.add(axesHelper)

/**
 * renderer
 */
const renderer = new THREE.WebGLRenderer({
	antialias: window.devicePixelRatio < 2,
})
document.body.appendChild(renderer.domElement)

/**
 * OrbitControls
 */
// __controls__
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
const directionalLight = new THREE.DirectionalLight(0xffffff, 4.5)
directionalLight.position.set(3, 10, 7)
scene.add(ambientLight, directionalLight)

/**
 * Post Processing - Outline from face colors
 */
const OutlineShader = {
	uniforms: {
		tDiffuse: { value: null },
		resolution: { value: new THREE.Vector2(sizes.width, sizes.height) },
		edgeWidth: { value: 1.0 },
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		uniform float edgeWidth;
		varying vec2 vUv;

		void main() {
			vec2 texel = vec2(edgeWidth) / resolution;

			vec3 center = texture2D(tDiffuse, vUv).rgb;
			vec3 left   = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb;
			vec3 right  = texture2D(tDiffuse, vUv + vec2( texel.x, 0.0)).rgb;
			vec3 up     = texture2D(tDiffuse, vUv + vec2(0.0,  texel.y)).rgb;
			vec3 down   = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb;

			// color difference with neighbors
			float diffL = length(center - left);
			float diffR = length(center - right);
			float diffU = length(center - up);
			float diffD = length(center - down);

			float edge = max(max(diffL, diffR), max(diffU, diffD));

			// threshold: if neighbor color differs significantly -> edge
			float isEdge = smoothstep(0.01, 0.1, edge);

			// on edge: show the face color, otherwise: white
			vec3 finalColor = mix(vec3(1.0), vec3(0.0), isEdge);

			gl_FragColor = vec4(finalColor, 1.0);
		}
	`,
}

const composer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const outlinePass = new ShaderPass(OutlineShader)
composer.addPass(outlinePass)

const fxaaPass = new ShaderPass(FXAAShader)
composer.addPass(fxaaPass)

handleResize()

pane.addBinding(outlinePass.uniforms.edgeWidth, 'value', {
	label: 'edgeWidth',
	min: 0.5,
	max: 5.0,
	step: 0.1,
})

/**
 * Three js Clock
 */
// __clock__
// const clock = new THREE.Clock()

/**
 * frame loop
 */
function tic() {
	/**
	 * tempo trascorso dal frame precedente
	 */
	// const deltaTime = clock.getDelta()
	/**
	 * tempo totale trascorso dall'inizio
	 */
	// const time = clock.getElapsedTime()

	// __controls_update__
	controls.update()

	composer.render()

	requestAnimationFrame(tic)
}

requestAnimationFrame(tic)

window.addEventListener('resize', handleResize)

function handleResize() {
	sizes.width = window.innerWidth
	sizes.height = window.innerHeight

	camera.aspect = sizes.width / sizes.height
	camera.updateProjectionMatrix()

	const pixelRatio = Math.min(window.devicePixelRatio, 2)

	renderer.setPixelRatio(pixelRatio)
	renderer.setSize(sizes.width, sizes.height)

	composer.setPixelRatio(pixelRatio)
	composer.setSize(sizes.width, sizes.height)

	outlinePass.uniforms.resolution.value.set(
		sizes.width * pixelRatio,
		sizes.height * pixelRatio,
	)
	fxaaPass.material.uniforms['resolution'].value.set(
		1 / (sizes.width * pixelRatio),
		1 / (sizes.height * pixelRatio),
	)
}
