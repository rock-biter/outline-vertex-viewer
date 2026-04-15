import './style.css'
import * as THREE from 'three'
// __controls_import__
// __gui_import__

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { Pane } from 'tweakpane'

/**
 * Debug
 */
// __gui__
const config = {
	example: 5,
}
const pane = new Pane()

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
	uniforms: {
		contrast: { value: 1.5 },
	},
	vertexShader: /* glsl */ `
		attribute vec3 color;
		varying vec3 vColor;
		void main() {
			vColor = color;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: /* glsl */ `
		uniform float contrast;
		varying vec3 vColor;
		void main() {
			vec3 c = (vColor - 0.5) * contrast + 0.5;
			c = clamp(c, 0.0, 1.0);
			gl_FragColor = vec4(c, 1.0);
		}
	`,
})

const mesh = new THREE.Mesh(geometry, material)
mesh.position.y += 0.5
scene.add(mesh)

let currentModel = mesh

/**
 * Drag & Drop GLTF/GLB
 */
const gltfLoader = new GLTFLoader()

function assignFaceColors(geo) {
	const count = geo.attributes.position.count
	const colorsArr = new Float32Array(count * 3)
	const palette = [
		new THREE.Color('red'),
		new THREE.Color('blue'),
		new THREE.Color('green'),
		new THREE.Color('yellow'),
		new THREE.Color('cyan'),
		new THREE.Color('magenta'),
		new THREE.Color('orange'),
		new THREE.Color('purple'),
	]

	if (geo.index) {
		// indexed geometry: color per triangle
		const faceCount = geo.index.count / 3
		const vertexFace = new Float32Array(count * 3)
		for (let f = 0; f < faceCount; f++) {
			const c = palette[f % palette.length]
			for (let v = 0; v < 3; v++) {
				const idx = geo.index.getX(f * 3 + v)
				vertexFace[idx * 3] = c.r
				vertexFace[idx * 3 + 1] = c.g
				vertexFace[idx * 3 + 2] = c.b
			}
		}
		geo.setAttribute('color', new THREE.BufferAttribute(vertexFace, 3))
	} else {
		// non-indexed: every 3 vertices = 1 face
		const faceCount = count / 3
		for (let f = 0; f < faceCount; f++) {
			const c = palette[f % palette.length]
			for (let v = 0; v < 3; v++) {
				const i = (f * 3 + v) * 3
				colorsArr[i] = c.r
				colorsArr[i + 1] = c.g
				colorsArr[i + 2] = c.b
			}
		}
		geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3))
	}
}

function reconstructQuarter(model) {
	// Collect all geometries with their world transforms baked in
	const geometries = []
	model.updateMatrixWorld(true)
	model.traverse((child) => {
		if (child.isMesh) {
			const geo = child.geometry.clone()
			geo.applyMatrix4(child.matrixWorld)
			geometries.push(geo)
		}
	})
	if (geometries.length === 0) return model

	// Create 4 copies: original + 3 rotations of 90° around Y
	const allGeos = []
	for (let i = 0; i < 4; i++) {
		const angle = (Math.PI / 2) * i
		const rotMatrix = new THREE.Matrix4().makeRotationY(angle)
		for (const geo of geometries) {
			const rotated = geo.clone()
			rotated.applyMatrix4(rotMatrix)
			allGeos.push(rotated)
		}
	}

	const merged = mergeGeometries(allGeos, false)
	if (!merged) return model

	const mesh = new THREE.Mesh(merged, material)
	return mesh
}

function loadModel(file) {
	const url = URL.createObjectURL(file)
	gltfLoader.load(url, (gltf) => {
		URL.revokeObjectURL(url)

		// remove current model
		scene.remove(currentModel)

		let model = gltf.scene

		// if it's a colosseum quarter, reconstruct the full model
		const isQuarter = file.name.toLowerCase().includes('colosseum-quarter')
		if (isQuarter) {
			model = reconstructQuarter(model)
		}

		// apply vertex colors + shader material to each mesh
		model.traverse((child) => {
			if (child.isMesh) {
				// assignFaceColors(child.geometry)
				child.material = material
			}
		})

		// auto-center and scale
		const box = new THREE.Box3().setFromObject(model)
		const size = box.getSize(new THREE.Vector3())
		const center = box.getCenter(new THREE.Vector3())
		const maxDim = Math.max(size.x, size.y, size.z)
		const scale = 2 / maxDim
		model.scale.setScalar(scale)
		model.position.sub(center.multiplyScalar(scale))
		model.position.y += (size.y * scale) / 2

		scene.add(model)
		currentModel = model
	})
}

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

renderer.domElement.addEventListener('dragover', (e) => {
	e.preventDefault()
	e.dataTransfer.dropEffect = 'copy'
})

renderer.domElement.addEventListener('drop', (e) => {
	e.preventDefault()
	const file = [...e.dataTransfer.files].find((f) =>
		/\.(glb|gltf)$/i.test(f.name),
	)
	if (file) loadModel(file)
})

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
		edgeColor: { value: new THREE.Color(0x0c1fe7) },
		threshold: { value: 0.5 },
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
		uniform vec3 edgeColor;
		uniform float threshold;
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
			float isEdge = smoothstep(0.01, threshold, edge);

			// on edge: show the edge color, otherwise: white
			vec3 finalColor = mix(vec3(1.0), edgeColor, isEdge);

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

const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
composer.addPass(gammaCorrectionPass)

handleResize()

pane.addBinding(outlinePass.uniforms.edgeWidth, 'value', {
	label: 'edgeWidth',
	min: 0.5,
	max: 5.0,
	step: 0.1,
})

pane.addBinding(outlinePass.uniforms.threshold, 'value', {
	label: 'threshold',
	min: 0.01,
	max: 1.0,
	step: 0.01,
})

const edgeColorParams = { color: '#0C1FE7' }
pane
	.addBinding(edgeColorParams, 'color', {
		label: 'edgeColor',
	})
	.on('change', (ev) => {
		outlinePass.uniforms.edgeColor.value.set(ev.value)
	})

pane.addBinding(material.uniforms.contrast, 'value', {
	label: 'contrast',
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
