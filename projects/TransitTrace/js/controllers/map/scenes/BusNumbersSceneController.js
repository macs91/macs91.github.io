/**
 * @class BusNumbersSceneController
 * @description
 *
 * @author Massimo De Marchi
 * @created 3/10/15.
 */
function BusNumbersSceneController() {
    SceneController.call(this);

    /*---------------- PRIVATE ATTRIBUTES ----------------*/
    var self = this;

    var _trips = null;
    var _needUpdate = false;

    // Text
    var _vehiclesLabelGroup = null;
    var _vehiclesLabels = {};

    /*------------------ PUBLIC METHODS ------------------*/
    /**
     * Update the model of the scene
     */
    this.update = function() {
        var currentTime = __model.getAnimationModel().getTime();
        if(_trips != null) {
            //var trips = d3.values(_trips);

            if(__model.getAnimationModel().getState() == AnimationState.START) {
                _trips = __model.getCTAModel().getTrips();
                _vehiclesLabels = {};
                updateAnimation();
                _needUpdate = false;
            } else {
                for(var tripId in _trips) {
                    var vehicleData = _trips[tripId];

                    // Compute vehicle last stop
                    var previousStopIndex = getLastStopIndex(currentTime, vehicleData["stops"]);

                    // Compute relevance of the vehicle position (if not relevant then do not display it or use low opacity)
                    var relevant = vehicleData["hop"] == 0 || (previousStopIndex +1) >= vehicleData["closestStopIndex"];

                    if(previousStopIndex > -1 && relevant) {
                        // Compute next stop time in seconds
                        var next = vehicleData["stops"][previousStopIndex +1]["arrivalTime"];
                        next = Utils.toSeconds(next.hh, next.mm, next.ss);

                        // Compute previous stop time in seconds
                        var previous = vehicleData["stops"][previousStopIndex]["departureTime"];
                        previous = Utils.toSeconds(previous.hh, previous.mm, previous.ss);

                        // Compute time passed from the previous stop
                        var delta = (currentTime - previous) / (next - previous);
                        var lat = d3.interpolateNumber(
                            parseFloat(vehicleData["stops"][previousStopIndex]["lat"]),
                            parseFloat(vehicleData["stops"][previousStopIndex +1]["lat"])
                        )(delta);
                        var lon = d3.interpolateNumber(
                            parseFloat(vehicleData["stops"][previousStopIndex]["lon"]),
                            parseFloat(vehicleData["stops"][previousStopIndex +1]["lon"])
                        )(delta);

                        var projection = __model.getMapModel().project(lat, lon);

                        var tColor = new THREE.Color();
                        tColor.setStyle("#fff");

                        if(vehicleData["type"] != 1) {
                            if(_vehiclesLabels[tripId] == undefined) {
                                _vehiclesLabels[tripId] = getLabelMesh(vehicleData["routeId"], tColor);
                                _vehiclesLabelGroup.add(_vehiclesLabels[tripId]);
                            }
                            positionTextMesh(_vehiclesLabels[tripId], projection.x, projection.y);
                        }
                    } else if(_vehiclesLabels[tripId] != undefined) {
                        _vehiclesLabelGroup.remove(_vehiclesLabels[tripId]);
                        _vehiclesLabels[tripId] = undefined;
                    }
                }
            }
        } else if(_needUpdate) {
            _trips = __model.getCTAModel().getTrips();
            _vehiclesLabels = {};
            updateAnimation();
            _needUpdate = false;
        }
    };

    this.dataUpdated = function() {
        _needUpdate = true;
    };

    /*------------------ PRIVATE METHODS -----------------*/
    var getLabelMesh = function(text, color) {
        var textGeometry = new THREE.TextGeometry(text, {
            font: 'helvetiker',
            //weight: "regular",
            style: "normal",
            size: 6
        });

        var material = new THREE.MeshBasicMaterial({color: color});
        var mesh = new THREE.Mesh(textGeometry, material);

        mesh.rotation.x = Math.PI;

        return mesh;
    };

    var positionTextMesh = function(mesh, x, y) {
        var textGeometry = mesh.geometry;
        textGeometry.computeBoundingBox();
        var deltaX = -0.5 * ( textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x );
        var deltaY = 0.5 * ( textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y );
        mesh.position.x = x + deltaX -1.5;
        mesh.position.y = y + deltaY;
    };


    var updateAnimation = function() {
        if(_vehiclesLabelGroup != null) {
            self.getScene().remove(_vehiclesLabelGroup);
        }
        _vehiclesLabelGroup = new THREE.Group();
        _vehiclesLabelGroup.position.z = 2;
        self.getScene().add(_vehiclesLabelGroup);
    };


    var init = function () {
        __notificationCenter.subscribe(self, self.dataUpdated, Notifications.CTA.TRIPS_UPDATED);
    }();
}

Utils.extend(BusNumbersSceneController, SceneController);