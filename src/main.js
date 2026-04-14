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
// scene.background = new THREE.Color(0x000000)

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
		contrast: { value: 0.7 },
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
// scene.add(mesh)

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

function loadModel(file) {
	const url = URL.createObjectURL(file)
	gltfLoader.load(url, (gltf) => {
		URL.revokeObjectURL(url)

		// remove current model
		scene.remove(currentModel)

		const model = gltf.scene

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
camera.position.set(2, 1, -2)
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
	alpha: true,
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
 * Mouse tracking
 */
const mouse = new THREE.Vector2(-1, -1)
let mouseActive = 0

renderer.domElement.addEventListener('mousemove', (e) => {
	mouse.x = e.clientX / sizes.width
	mouse.y = 1.0 - e.clientY / sizes.height
	mouseActive = 1.0
})

renderer.domElement.addEventListener('mouseleave', () => {
	mouseActive = 0
})

/**
 * Ping-pong trail buffers + curl noise simulation
 */
const trailRTParams = {
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
	format: THREE.RGBAFormat,
	type: THREE.HalfFloatType,
}
const initPixelRatio = Math.min(window.devicePixelRatio, 2)
const trailTargets = [
	new THREE.WebGLRenderTarget(
		sizes.width * initPixelRatio,
		sizes.height * initPixelRatio,
		trailRTParams,
	),
	new THREE.WebGLRenderTarget(
		sizes.width * initPixelRatio,
		sizes.height * initPixelRatio,
		trailRTParams,
	),
]
let currentTrailIndex = 0

const trailMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tPrevTrail: { value: null },
		uResolution: {
			value: new THREE.Vector2(
				sizes.width * initPixelRatio,
				sizes.height * initPixelRatio,
			),
		},
		uMouse: { value: new THREE.Vector2(-1, -1) },
		uMouseActive: { value: 0 },
		uTime: { value: 0 },
		uDecay: { value: 0.964 },
		uTrailSize: { value: 0.093 },
		uDiffusion: { value: new THREE.Vector3(0.71, 0.6, 0.35) },
		uCurlScale: { value: 12.4 },
		uCurlStrength: { value: 0.8 },
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tPrevTrail;
		uniform vec2 uResolution;
		uniform vec2 uMouse;
		uniform float uMouseActive;
		uniform float uTime;
		uniform float uDecay;
		uniform float uTrailSize;
		uniform vec3 uDiffusion;
		uniform float uCurlScale;
		uniform float uCurlStrength;
		varying vec2 vUv;

		vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec3 permute(vec3 x) { return mod289_3(((x * 34.0) + 1.0) * x); }

		float snoise(vec2 v) {
			const vec4 C = vec4(0.211324865405187, 0.366025403784439,
			                     -0.577350269189626, 0.024390243902439);
			vec2 i  = floor(v + dot(v, C.yy));
			vec2 x0 = v - i + dot(i, C.xx);
			vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
			vec4 x12 = x0.xyxy + C.xxzz;
			x12.xy -= i1;
			i = mod289_2(i);
			vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
			                         + i.x + vec3(0.0, i1.x, 1.0));
			vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
			                        dot(x12.zw, x12.zw)), 0.0);
			m = m * m;
			m = m * m;
			vec3 x = 2.0 * fract(p * C.www) - 1.0;
			vec3 h = abs(x) - 0.5;
			vec3 ox = floor(x + 0.5);
			vec3 a0 = x - ox;
			m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
			vec3 g;
			g.x  = a0.x  * x0.x  + h.x  * x0.y;
			g.yz = a0.yz * x12.xz + h.yz * x12.yw;
			return 130.0 * dot(m, g);
		}

		void main() {
			vec2 uv = vUv;
			vec2 texel = 5.0 / uResolution;

			vec3 center = texture2D(tPrevTrail, uv).rgb;

			// Noise-modulated diffusion offsets for jagged edges
			float n0 = snoise(uv * uCurlScale + uTime * 0.05) * 0.5 + 0.5;
			float n1 = snoise(uv * uCurlScale * 1.3 + uTime * 0.07 + 43.0) * 0.5 + 0.5;
			float n2 = snoise(uv * uCurlScale * 0.8 + uTime * 0.03 + 97.0) * 0.5 + 0.5;
			float n3 = snoise(uv * uCurlScale * 1.6 + uTime * 0.09 + 151.0) * 0.5 + 0.5;

			// Sample neighbors with noise-scaled offsets
			float spread = uCurlStrength;
			vec3 l = texture2D(tPrevTrail, uv + vec2(-texel.x, 0.0) * spread * n0).rgb;
			vec3 r = texture2D(tPrevTrail, uv + vec2( texel.x, 0.0) * spread * n1).rgb;
			vec3 u = texture2D(tPrevTrail, uv + vec2(0.0,  texel.y) * spread * n2).rgb;
			vec3 d = texture2D(tPrevTrail, uv + vec2(0.0, -texel.y) * spread * n3).rgb;
			// vec3 blurred = (l + r + u + d) * 0.25;
			vec3 blurred = max(max(max(l, r), max(u, d)), center);
			// blurred = clamp(blurred, 0.0, 1.0);

			// Per-channel diffusion: R=slow, G=medium, B=fast
			vec3 result;
			result.r = blurred.r * uDiffusion.r;
			result.g = blurred.g * uDiffusion.g;
			result.b = blurred.b * uDiffusion.b;

			// Decay
			result *= uDecay;

			// Mouse stamp
			float aspect = uResolution.x / uResolution.y;
			float dist = length((uv - uMouse) * vec2(aspect, 1.0));
			float stamp = smoothstep(uTrailSize, 0.0, dist) * uMouseActive;
			result = max(result, vec3(stamp));

			gl_FragColor = vec4(result, 1.0);
		}
	`,
})

const trailScene = new THREE.Scene()
const trailCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const trailQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial)
trailScene.add(trailQuad)

/**
 * Post Processing - Outline from face colors
 */
const OutlineShader = {
	uniforms: {
		tDiffuse: { value: null },
		resolution: { value: new THREE.Vector2(sizes.width, sizes.height) },
		edgeWidth: { value: 0.5 },
		edgeColor: { value: new THREE.Color(0xffffff) }, //#0c1fe7
		threshold: { value: 0.01 },
		luminosity: { value: 1.73 },
		tTrail: { value: null },
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
		uniform float luminosity;
		uniform sampler2D tTrail;
		varying vec2 vUv;

		void main() {
			vec2 texel = vec2(edgeWidth) / resolution;

			vec4 center4 = texture2D(tDiffuse, vUv);
			vec3 center = center4.rgb;
			

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

			if(center4.a <= 0.1) {
				center = vec3(1.0);
			}

			float luminance = dot(center, vec3(0.299, 0.587, 0.114)) * luminosity;

			// mix center color with luminance using trail, then with edgeColor
			vec3 luminanceColor = vec3(luminance);

			// mouse trail: RGB channels with different diffusion speeds
			vec3 trail = texture2D(tTrail, vUv).rgb;

			float r = pow(trail.r, 3.);
			float g = pow(trail.g, 0.9);
			float b = pow(trail.b, 0.2);
			float mixColor = max(max(r, g), b);
			mixColor = pow(mixColor, 1.0 / 10.0); // use the slowest diffusion channel as mix factor
			// mixColor = fract(mixColor * 10.) / 10.; // optional: smooth the mix factor
			vec3 c = center4.rgb;
			mixColor = clamp(mixColor, 0.0, 1.0);

			vec3 trailMixed = mix(luminanceColor, c, smoothstep(0.0,0.02,mixColor));
			vec3 finalColor = mix(trailMixed, edgeColor, isEdge);

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
// composer.addPass(gammaCorrectionPass)

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

pane.addBinding(outlinePass.uniforms.luminosity, 'value', {
	label: 'luminosity',
	min: 0.0,
	max: 3.0,
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

const trailFolder = pane.addFolder({ title: 'Trail' })

trailFolder.addBinding(trailMaterial.uniforms.uDecay, 'value', {
	label: 'decay',
	min: 0.9,
	max: 1.0,
	step: 0.001,
})

trailFolder.addBinding(trailMaterial.uniforms.uTrailSize, 'value', {
	label: 'trailSize',
	min: 0.01,
	max: 0.2,
	step: 0.001,
})

trailFolder.addBinding(trailMaterial.uniforms.uCurlScale, 'value', {
	label: 'curlScale',
	min: 0.5,
	max: 100.0,
	step: 0.1,
})

trailFolder.addBinding(trailMaterial.uniforms.uCurlStrength, 'value', {
	label: 'curlStrength',
	min: 0.0,
	max: 20.0,
	step: 0.1,
})

const diffusionParams = {
	r: trailMaterial.uniforms.uDiffusion.value.x,
	g: trailMaterial.uniforms.uDiffusion.value.y,
	b: trailMaterial.uniforms.uDiffusion.value.z,
}

trailFolder
	.addBinding(diffusionParams, 'r', {
		label: 'diffusion R (slow)',
		min: 0.0,
		max: 1.0,
		step: 0.01,
	})
	.on('change', (ev) => {
		trailMaterial.uniforms.uDiffusion.value.x = ev.value
	})

trailFolder
	.addBinding(diffusionParams, 'g', {
		label: 'diffusion G (mid)',
		min: 0.0,
		max: 1.0,
		step: 0.01,
	})
	.on('change', (ev) => {
		trailMaterial.uniforms.uDiffusion.value.y = ev.value
	})

trailFolder
	.addBinding(diffusionParams, 'b', {
		label: 'diffusion B (fast)',
		min: 0.0,
		max: 1.0,
		step: 0.01,
	})
	.on('change', (ev) => {
		trailMaterial.uniforms.uDiffusion.value.z = ev.value
	})

/**
 * Three js Clock
 */
// __clock__
const clock = new THREE.Clock()

/**
 * frame loop
 */
function tic() {
	const time = clock.getElapsedTime()

	// Update trail simulation
	trailMaterial.uniforms.uTime.value = time
	trailMaterial.uniforms.uMouse.value.copy(mouse)
	trailMaterial.uniforms.uMouseActive.value = mouseActive
	mouseActive = 0

	trailMaterial.uniforms.tPrevTrail.value =
		trailTargets[currentTrailIndex].texture
	renderer.setRenderTarget(trailTargets[1 - currentTrailIndex])
	renderer.render(trailScene, trailCamera)
	renderer.setRenderTarget(null)
	currentTrailIndex = 1 - currentTrailIndex

	outlinePass.uniforms.tTrail.value = trailTargets[currentTrailIndex].texture

	// __controls_update__
	controls.update()

	composer.render()

	requestAnimationFrame(tic)
}

requestAnimationFrame(tic)

// Load default model
gltfLoader.load('/3d/whale.glb', (gltf) => {
	scene.remove(currentModel)
	const model = gltf.scene
	model.traverse((child) => {
		if (child.isMesh) {
			child.material = material
		}
	})
	const box = new THREE.Box3().setFromObject(model)
	const size = box.getSize(new THREE.Vector3())
	const center = box.getCenter(new THREE.Vector3())
	const maxDim = Math.max(size.x, size.y, size.z)
	const scale = 2 / maxDim
	model.scale.setScalar(scale)
	model.position.sub(center.multiplyScalar(scale))
	// model.position.y += (size.y * scale) / 2
	scene.add(model)
	currentModel = model
})

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

	trailTargets[0].setSize(sizes.width * pixelRatio, sizes.height * pixelRatio)
	trailTargets[1].setSize(sizes.width * pixelRatio, sizes.height * pixelRatio)
	trailMaterial.uniforms.uResolution.value.set(
		sizes.width * pixelRatio,
		sizes.height * pixelRatio,
	)

	fxaaPass.material.uniforms['resolution'].value.set(
		1 / (sizes.width * pixelRatio),
		1 / (sizes.height * pixelRatio),
	)
}
