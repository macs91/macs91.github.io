/**
 * @class TrailsSceneController
 * @description
 *
 * @author Massimo De Marchi
 * @created 3/9/15.
 */
function TrailsSceneController() {
    SceneController.call(this);

    /*---------------- PRIVATE ATTRIBUTES ----------------*/
    var self = this;

    var _trips = null;
    var _needUpdate = false;

    var _geometryBuffer;
    var _mesh = null;

    // Animation settings
    var _trailLength = 400;
    var _metroHeadSize = 20 * window.devicePixelRatio;
    var _headSize = 15 * window.devicePixelRatio;
    var _maxTrailSize = 3.5 * window.devicePixelRatio;
    var _minTrailSize = 2 * window.devicePixelRatio;
    var _decrementPerFrame = 0.005 * window.devicePixelRatio;
    var _minOpacity = 0.1;
    var _maxOpacity = 0.7;
    var _deltaOpacity = 0.01;

    var _pointsTimeInterval = 2;

    /*------------------ PUBLIC METHODS ------------------*/
    /**
     * @override
     * Update the model of the scene
     */
    this.update = function() {
        if(_trips != null) {

            if(__model.getAnimationModel().getState() == AnimationState.START) {
                _trips = __model.getCTAModel().getTrips();
                updateAnimation();
                _needUpdate = false;
            } else {
                computeScene(__model.getAnimationModel().getTime());
            }

            _geometryBuffer.attributes.position.needsUpdate = true;
            _geometryBuffer.attributes.size.needsUpdate = true;
            _geometryBuffer.attributes.customColor.needsUpdate = true;
            _geometryBuffer.attributes.vertexOpacity.needsUpdate = true;
        } else if(_needUpdate) {
            _trips = __model.getCTAModel().getTrips();
            updateAnimation();
            _needUpdate = false;
        }
    };

    this.dataUpdated = function() {
        _needUpdate = true;
    };


    /*------------------ PRIVATE METHODS -----------------*/
    var computeScene = function(time) {
        var trailStartTime = time - __model.getCTAModel().getMaximumTransferTime();
        var pointsPerTrip = __model.getCTAModel().getMaximumTransferTime() / _pointsTimeInterval;

        var size = _geometryBuffer.attributes.size.array;
        var position = _geometryBuffer.attributes.position.array;
        var color = _geometryBuffer.attributes.customColor.array;
        var opacity = _geometryBuffer.attributes.vertexOpacity.array;

        var tColor = new THREE.Color();

        var i;
        for(i = 0; i < size.length; i++) {
            size[i] = 0;
        }

        i = 0;
        // For each vehicle update its buffer portion
        for(var tripId in _trips) {
            var vehicleData = _trips[tripId];
            var firstRelevantStopIndex = Utils.cta.getLastStopIndex(trailStartTime, vehicleData["stops"]);
            console.time("trip");
            var previousStopIndex = firstRelevantStopIndex;
            for(var instant = trailStartTime; instant < time; instant += _pointsTimeInterval) {
                //console.time("loop");
                // Compute relevance of the vehicle position (if not relevant then do not display it or use low opacity)
                var relevant = vehicleData["hop"] == 0 || (previousStopIndex +1) >= vehicleData["closestStopIndex"];

                if(relevant && previousStopIndex != -1) {
                    // Compute next stop time in seconds

                    var next = vehicleData["stops"][previousStopIndex +1]["arrivalTime"];
                    next = Utils.toSeconds(next.hh, next.mm, next.ss);

                    // Compute previous stop time in seconds
                    var previous = vehicleData["stops"][previousStopIndex]["departureTime"];
                    previous = Utils.toSeconds(previous.hh, previous.mm, previous.ss);

                    // Compute time passed from the previous stop
                    var delta = (instant - previous) / (next - previous);
                    var lat = d3.interpolateNumber(
                        parseFloat(vehicleData["stops"][previousStopIndex]["lat"]),
                        parseFloat(vehicleData["stops"][previousStopIndex +1]["lat"])
                    )(delta);
                    var lon = d3.interpolateNumber(
                        parseFloat(vehicleData["stops"][previousStopIndex]["lon"]),
                        parseFloat(vehicleData["stops"][previousStopIndex +1]["lon"])
                    )(delta);



                    var projection = __model.getMapModel().project(lat, lon);



                    delta = (instant - trailStartTime) / (__model.getCTAModel().getMaximumTransferTime());

                    size[i] = d3.interpolate(_maxTrailSize, _minTrailSize)(1 - delta);
                    opacity[i] = d3.interpolate(_maxOpacity, _minOpacity)(1 - Math.pow(delta, 4));

                    position[i * 3] = projection.x;
                    position[i * 3 +1] = projection.y;
                    position[i * 3 +2] = 1;

                    if(vehicleData["color"] != undefined) {
                        tColor.setStyle("#" + vehicleData["color"]);
                    } else if(vehicleData["hop"] == 0) {
                        tColor.setStyle("#3182bd");
                    } else {
                        tColor.setStyle("#95a5a6");
                    }

                    color[i * 3] = tColor.r;
                    color[i * 3 +1] = tColor.g;
                    color[i * 3 +2] = tColor.b;

                    // Update buffer Index
                    i++;

                    // Update index
                    if(instant >= Utils.cta.toSeconds(vehicleData["stops"][previousStopIndex +1]["arrivalTime"])) {
                        previousStopIndex++;
                        if(previousStopIndex +1 >= vehicleData["stops"].length) {
                            previousStopIndex = -1;
                        }
                    }
                }
                //console.timeEnd("loop");
            } console.timeEnd("trip");
            debugger;
        }
    };

    var updateAnimation = function() {
        // Initialize WebGL variables
        var attributes = {
            size: {	type: 'f', value: [] },
            customColor: { type: 'c', value: [] },
            vertexOpacity: { type: 'f', value: [] }
        };

        var uniforms = {
            texture:   { type: "t", value: Utils.gl.circleTexture() }
        };

        var shaderMaterial = new THREE.ShaderMaterial( {
            uniforms:       uniforms,
            attributes:     attributes,
            vertexShader:   document.getElementById( 'vertexshader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader' ).textContent,

            //blending:       THREE.AdditiveBlending,
            depthTest:      false,
            transparent:    true,
            sizeAttenuation: false,
            vertexColors: THREE.VertexColors
        });

        // Handling trails
        var trips = d3.values(_trips);

        var pointsPerTrip = __model.getCTAModel().getMaximumTransferTime() / _pointsTimeInterval;
        //pointsPerTrip = _trailLength;

        _geometryBuffer = new THREE.BufferGeometry();
        var buffer = new Float32Array(trips.length * pointsPerTrip * 3);
        _geometryBuffer.addAttribute('position', new THREE.BufferAttribute(buffer, 3));
        buffer = new Float32Array(trips.length * pointsPerTrip * 3);
        _geometryBuffer.addAttribute('customColor', new THREE.BufferAttribute(buffer, 3));
        buffer = new Float32Array(trips.length * pointsPerTrip);
        _geometryBuffer.addAttribute('size', new THREE.BufferAttribute(buffer, 1));
        buffer = new Float32Array(trips.length * pointsPerTrip);
        _geometryBuffer.addAttribute('vertexOpacity', new THREE.BufferAttribute(buffer, 1));

        if(_mesh != null) {
            self.getScene().remove(_mesh);
        }
        _mesh = new THREE.PointCloud( _geometryBuffer, shaderMaterial );


        var size = _geometryBuffer.attributes.size.array;
        var opacity = _geometryBuffer.attributes.vertexOpacity.array;

        for(var i = 0; i < size.length; i++) {
            size[i] = 0;
            opacity[i] = 1;
        }

        self.getScene().add(_mesh);
    };


    var init = function () {
        __notificationCenter.subscribe(self, self.dataUpdated, Notifications.CTA.TRIPS_UPDATED);
    }();
}

Utils.extend(TrailsSceneController, SceneController);