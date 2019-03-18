/* global THREE, WEBVR */

var container
var camera, scene, renderer
var controller1, controller2

function loadTexture (path, size, scale) {
  if (!scale) {
    scale = 1
  }
  const texture = new THREE.TextureLoader().load(path)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(size[0] * scale, size[1] * scale)
  return texture
}

function testMaterial () {
  return new THREE.MeshBasicMaterial({color: 0x00ff00})
}

function loadMaterial (name, size, scale) {
  const color = loadTexture(`textures/${name}/${name}_COLOR.jpg`, size, scale)
  // const disp = loadTexture(`textures/${name}/${name}_DISP.png`, size, scale)
  const norm = loadTexture(`textures/${name}/${name}_NORM.jpg`, size, scale)
  const occ = loadTexture(`textures/${name}/${name}_OCC.jpg`, size, scale)
  const spec = loadTexture(`textures/${name}/${name}_SPEC.jpg`, size, scale)
  return new THREE.MeshPhongMaterial({
    aoMap: occ,
    // displacementMap: disp,
    normalMap: norm,
    specularMap: spec,
    map: color
  })
}

function generateFloor (scene, floor, height, object) {
  const floorHeight = 0.1524

  const [x, z] = object.position
  const [width, length] = object.size
  const geometry = new THREE.BoxGeometry(width, floorHeight, length)
  const material = loadMaterial(object.material, object.size, object.scale)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = height - floorHeight / 2
  mesh.position.x = x
  mesh.position.z = z
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
}

function generateWall (scene, floor, height, object) {
  const wallWidth = 0.1524
  const wallHeight = object.height ? object.height : floor.height

  const {start, end} = object
  const length = Math.sqrt(
    Math.pow(start[0] - end[0], 2) + Math.pow(start[1] - end[1], 2))
  const angle = Math.atan2(start[0] - end[0], start[1] - end[1])
  const geometry = new THREE.BoxGeometry(wallWidth, wallHeight, length)
  const material = loadMaterial(object.material, [length, wallHeight], object.scale)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.y = angle
  mesh.position.y = height + (wallHeight / 2)
  mesh.position.x = (start[0] + end[0]) / 2
  mesh.position.z = (start[1] + end[1]) / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
}

const generators = {
  floor: generateFloor,
  wall: generateWall
}

function generateScene (data) {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x505050)
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 10, 0)
  camera.lookAt(scene.position)

  const sky = new THREE.Sky()
  sky.scale.setScalar(450000)
  scene.add(sky)

  // Add Sun Helper
  const sunSphere = new THREE.Mesh(
    new THREE.SphereBufferGeometry(20000, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  )
  sunSphere.position.y = -700000
  sunSphere.visible = false
  scene.add(sunSphere)

  var distance = 400000

  var uniforms = sky.material.uniforms
  uniforms[ 'turbidity' ].value = data.sky.turbidity
  uniforms[ 'rayleigh' ].value = data.sky.rayleigh
  uniforms[ 'luminance' ].value = data.sky.luminance
  uniforms[ 'mieCoefficient' ].value = data.sky.mieCoefficient
  uniforms[ 'mieDirectionalG' ].value = data.sky.mieDirectionalG

  var theta = Math.PI * (data.sky.inclination - 0.5)
  var phi = 2 * Math.PI * (data.sky.azimuth - 0.5)

  sunSphere.position.x = distance * Math.cos(phi)
  sunSphere.position.y = distance * Math.sin(phi) * Math.sin(theta)
  sunSphere.position.z = distance * Math.sin(phi) * Math.cos(theta)

  sunSphere.visible = data.sky.sun
  uniforms[ 'sunPosition' ].value.copy(sunSphere.position)

  var light = new THREE.HemisphereLight(0xffffff, 0x444444)
  light.castShadow = true
  light.position.set(1, 100, 1)
  scene.add(light)

  let height = 0
  data.floors.forEach(floor => {
    floor.objects.forEach(object => {
      generators[object.type](scene, floor, height, object)
    })

    height += floor.height
  })

  // Add controllers to scene
  scene.add(controller1)
  scene.add(controller2)
}

const speed = 0.5

function onDocumentKeyDown (event) {
  var keyCode = event.which
  if (keyCode === 87) {
    camera.position.z -= speed
  } else if (keyCode === 83) {
    camera.position.z += speed
  } else if (keyCode === 65) {
    camera.position.x -= speed
  } else if (keyCode === 68) {
    camera.position.x += speed
  } else if (keyCode === 32) {
    camera.position.set(0, 5, 0)
  }
}
document.addEventListener('keydown', onDocumentKeyDown, false)

function init () {
  const container = document.querySelector('#container')

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)

  // SHADOW
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  renderer.vr.enabled = false
  container.appendChild(renderer.domElement)

  document.body.appendChild(WEBVR.createButton(renderer))

  function onSelectStart () {
    this.userData.isSelecting = true
  }
  function onSelectEnd () {
    this.userData.isSelecting = false
  }
  controller1 = renderer.vr.getController(0)
  controller1.addEventListener('selectstart', onSelectStart)
  controller1.addEventListener('selectend', onSelectEnd)
  controller2 = renderer.vr.getController(1)
  controller2.addEventListener('selectstart', onSelectStart)
  controller2.addEventListener('selectend', onSelectEnd)

  // helpers
  var geometry = new THREE.BufferGeometry()
  geometry.addAttribute('position',
    new THREE.Float32BufferAttribute([ 0, 0, 0, 0, 0, -1 ], 3))
  geometry.addAttribute('color',
    new THREE.Float32BufferAttribute([ 0.5, 0.5, 0.5, 0, 0, 0 ], 3))
  var material = new THREE.LineBasicMaterial({
    vertexColors: true, blending: THREE.AdditiveBlending })
  controller1.add(new THREE.Line(geometry, material))
  controller2.add(new THREE.Line(geometry, material))

  generateScene({
    sky: {
      turbidity: 10,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      luminance: 1,
      inclination: 0.4, // elevation / inclination
      azimuth: 0.125, // Facing front,
      sun: false
    },
    floors: [
      {
        height: 2.7432,
        objects: [
          {
            type: 'floor',
            size: [10, 10],
            material: 'Stone_Floor_002',
            position: [0, 0]
          },
          {
            type: 'wall',
            start: [5, -5],
            end: [-5, -5],
            material: 'Brick_Wall_011',
            scale: 0.5
          },
          {
            type: 'wall',
            start: [2, -4],
            end: [-2, -4],
            material: 'Stone_Wall_004',
            scale: 0.75,
            height: 1
          }
        ]
      }
    ]
  })

  window.addEventListener('resize', onWindowResize, false)
}

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function handleController (controller) {
}

function animate () {
  renderer.setAnimationLoop(render)
}

function render () {
  handleController(controller1)
  handleController(controller2)

  renderer.render(scene, camera)
}

init()
animate()
