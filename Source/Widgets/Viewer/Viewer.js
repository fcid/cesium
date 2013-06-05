/*global define*/
define([
        '../../Core/Cartesian2',
        '../../Core/defaultValue',
        '../../Core/DeveloperError',
        '../../Core/defineProperties',
        '../../Core/destroyObject',
        '../../Core/ScreenSpaceEventType',
        '../../DynamicScene/DataSourceCollection',
        '../../DynamicScene/DataSourceDisplay',
        '../ClockViewModel',
        '../Animation/Animation',
        '../Animation/AnimationViewModel',
        '../BaseLayerPicker/BaseLayerPicker',
        '../BaseLayerPicker/createDefaultBaseLayers',
        '../CesiumWidget/CesiumWidget',
        '../DataSourceBrowser/DataSourceBrowser',
        '../FullscreenButton/FullscreenButton',
        '../HomeButton/HomeButton',
        '../SceneModePicker/SceneModePicker',
        '../Timeline/Timeline'
    ], function(
                Cartesian2,
                defaultValue,
                DeveloperError,
                defineProperties,
                destroyObject,
                ScreenSpaceEventType,
                DataSourceCollection,
                DataSourceDisplay,
                ClockViewModel,
                Animation,
                AnimationViewModel,
                BaseLayerPicker,
                createDefaultBaseLayers,
                CesiumWidget,
                DataSourceBrowser,
                FullscreenButton,
                HomeButton,
                SceneModePicker,
                Timeline) {
    "use strict";

    function setLogoOffset(centralBody, logoOffsetX, logoOffsetY) {
        var logoOffset = centralBody.logoOffset;
        if ((logoOffsetX !== logoOffset.x) || (logoOffsetY !== logoOffset.y)) {
            centralBody.logoOffset.x = logoOffsetX;
            centralBody.logoOffset.y = logoOffsetY;
        }
    }

    function onTimelineScrubfunction(e) {
        var clock = e.clock;
        clock.currentTime = e.timeJulian;
        clock.shouldAnimate = false;
    }

    /**
     * A base widget for building applications.  It composites all of the standard Cesium widgets into one reusable package.
     *
     * @alias Viewer
     * @constructor
     *
     * @param {Element|String} container The DOM element or ID that will contain the widget.
     * @param {Object} [options] Configuration options for the widget.
     * @param {Boolean} [options.animation=true] If set to false, the Animation widget will not be created.
     * @param {Boolean} [options.baselayerPicker=true] If set to false, the BaseLayerPicker widget will not be created.
     * @param {Boolean} [options.dataSourceBrowser=true] If set to false, the DataSourceBrowser widget will not be created.
     * @param {Boolean} [options.fullscreenButton=true] If set to false, the FullscreenButton widget will not be created.
     * @param {Boolean} [options.homeButton=true] If set to false, the HomeButton widget will not be created.
     * @param {Boolean} [options.sceneModePicker=true] If set to false, the SceneModePicker widget will not be created.
     * @param {Boolean} [options.timeline=true] If set to false, the Timeline widget will not be created.
     * @param {ImageryProviderViewModel} [options.selectedImageryProviderViewModel] The view model for the current base imagery layer, it not supplied the first available base layer is used.
     * @param {Array} [options.imageryProviderViewModels=createDefaultBaseLayers()] The array of ImageryProviderViewModels to be selectable from the BaseLyerPicker.
     * @param {TerrainProvider} [options.terrainProvider=new EllipsoidTerrainProvider()] The terrain provider to use
     * @param {Element} [options.fullscreenElement=container] The element to make full screen when the full screen button is pressed.
     * @param {SceneMode} [options.sceneMode=SceneMode.SCENE3D] The initial scene mode.
     *
     * @exception {DeveloperError} container is required.
     * @exception {DeveloperError} Element with id "container" does not exist in the document.
     *
     * @see Animation
     * @see BaseLayerPicker
     * @see CesiumWidget
     * @see FullscreenButton
     * @see HomeButton
     * @see SceneModePicker
     * @see Timeline
     */
    var Viewer = function(container, options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        if (typeof container === 'undefined') {
            throw new DeveloperError('container is required.');
        }

        if (typeof container === 'string') {
            var tmp = document.getElementById(container);
            if (tmp === null) {
                throw new DeveloperError('Element with id "' + container + '" does not exist in the document.');
            }
            container = tmp;
        }

        var viewerContainer = document.createElement('div');
        viewerContainer.className = 'cesium-viewer';
        container.appendChild(viewerContainer);

        //Cesium widget
        var cesiumWidgetContainer = document.createElement('div');
        cesiumWidgetContainer.className = 'cesium-viewer-cesiumWidgetContainer';
        viewerContainer.appendChild(cesiumWidgetContainer);
        var cesiumWidget = new CesiumWidget(cesiumWidgetContainer, {
            terrainProvider : options.terrainProvider,
            sceneMode : options.sceneMode
        });

        //Subscribe for resize events and set the initial size.
        this._resizeCallback = function() {
            setLogoOffset(cesiumWidget.centralBody, cesiumWidget.cesiumLogo.offsetWidth + cesiumWidget.cesiumLogo.offsetLeft + 10, 28);
        };
        window.addEventListener('resize', this._resizeCallback, false);
        this._resizeCallback();

        var clock = cesiumWidget.clock;

        var dataSourceCollection = new DataSourceCollection();
        this._dataSourceCollection = dataSourceCollection;

        //Data source display
        var dataSourceDisplay = new DataSourceDisplay(cesiumWidget.scene, dataSourceCollection);
        this._dataSourceDisplay = dataSourceDisplay;
        clock.onTick.addEventListener(this._onTick, this);

        var toolbar = document.createElement('div');
        toolbar.className = 'cesium-viewer-toolbar';
        viewerContainer.appendChild(toolbar);

        //HomeButton
        var homeButton;
        if (typeof options.homeButton === 'undefined' || options.homeButton !== false) {
            var homeButtonContainer = document.createElement('div');
            homeButtonContainer.className = 'cesium-viewer-homeButtonContainer';
            toolbar.appendChild(homeButtonContainer);
            homeButton = new HomeButton(homeButtonContainer, cesiumWidget.scene, cesiumWidget.sceneTransitioner, cesiumWidget.centralBody.getEllipsoid());
        }

        //SceneModePicker
        var sceneModePicker;
        if (typeof options.sceneModePicker === 'undefined' || options.sceneModePicker !== false) {
            var sceneModePickerContainer = document.createElement('div');
            sceneModePickerContainer.className = 'cesium-viewer-sceneModePickerContainer';
            toolbar.appendChild(sceneModePickerContainer);
            sceneModePicker = new SceneModePicker(sceneModePickerContainer, cesiumWidget.sceneTransitioner);
        }

        //BaseLayerPicker
        var baseLayerPicker;
        if (typeof options.baseLayerPicker === 'undefined' || options.baseLayerPicker !== false) {
            var baseLayerPickerContainer = document.createElement('div');
            baseLayerPickerContainer.className = 'cesium-viewer-baseLayerPickerContainer';
            toolbar.appendChild(baseLayerPickerContainer);
            var providerViewModels = defaultValue(options.imageryProviderViewModels, createDefaultBaseLayers());
            baseLayerPicker = new BaseLayerPicker(baseLayerPickerContainer, cesiumWidget.centralBody.getImageryLayers(), providerViewModels);
            baseLayerPicker.viewModel.selectedItem = defaultValue(options.selectedImageryProviderViewModel, providerViewModels[0]);
        }

        //Animation
        var animation;
        if (typeof options.animation === 'undefined' || options.animation !== false) {
            var clockViewModel = new ClockViewModel(clock);
            var animationContainer = document.createElement('div');
            animationContainer.className = 'cesium-viewer-animationContainer';
            viewerContainer.appendChild(animationContainer);
            animation = new Animation(animationContainer, new AnimationViewModel(clockViewModel));
        }

        //Timeline
        var timeline;
        if (typeof options.timeline === 'undefined' || options.timeline !== false) {
            var timelineContainer = document.createElement('div');
            timelineContainer.className = 'cesium-viewer-timelineContainer';
            viewerContainer.appendChild(timelineContainer);
            timeline = new Timeline(timelineContainer, clock);
            timeline.addEventListener('settime', onTimelineScrubfunction, false);
            timeline.zoomTo(clock.startTime, clock.stopTime);
        }

        //Fullscreen
        var fullscreenButton;
        if (typeof options.fullscreenButton === 'undefined' || options.fullscreenButton !== false) {
            var fullscreenContainer = document.createElement('div');
            fullscreenContainer.className = 'cesium-viewer-fullscreenContainer';
            viewerContainer.appendChild(fullscreenContainer);
            fullscreenButton = new FullscreenButton(fullscreenContainer, defaultValue(options.fullscreenElement, container));
        }

        //DataSourceBrowser
        var dataSourceBrowser;
        if (typeof options.dataSourceBrowser === 'undefined' || options.dataSourceBrowser !== false) {
            var dataSourceBrowserContainer = document.createElement('div');
            dataSourceBrowserContainer.className = 'cesium-viewer-dataSourceBrowserContainer';
            viewerContainer.appendChild(dataSourceBrowserContainer);
            dataSourceBrowser = new DataSourceBrowser(dataSourceBrowserContainer, dataSourceCollection);
        }

        this._container = container;
        this._viewerContainer = viewerContainer;
        this._cesiumWidget = cesiumWidget;
        this._toolbar = toolbar;
        this._homeButton = homeButton;
        this._sceneModePicker = sceneModePicker;
        this._baseLayerPicker = baseLayerPicker;
        this._animation = animation;
        this._timeline = timeline;
        this._fullscreenButton = fullscreenButton;
        this._dataSourceBrowser = dataSourceBrowser;
    };

    defineProperties(Viewer.prototype, {
        /**
         * Gets the parent container.
         * @memberof Viewer.prototype
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        },

        /**
         * Gets the CesiumWidget.
         * @memberof Viewer
         * @type {CesiumWidget}
         */
        cesiumWidget : {
            get : function() {
                return this._cesiumWidget;
            }
        },

        /**
         * Gets the HomeButton.
         * @memberof Viewer
         * @type {HomeButton}
         */
        homeButton : {
            get : function() {
                return this._homeButton;
            }
        },

        /**
         * Gets the SceneModePicker.
         * @memberof Viewer
         * @type {SceneModePicker}
         */
        sceneModePicker : {
            get : function() {
                return this._sceneModePicker;
            }
        },

        /**
         * Gets the BaseLayerPicker.
         * @memberof Viewer
         * @type {BaseLayerPicker}
         */
        baseLayerPicker : {
            get : function() {
                return this._baseLayerPicker;
            }
        },

        /**
         * Gets the Animation widget.
         * @memberof Viewer
         * @type {Animation}
         */
        animation : {
            get : function() {
                return this._animation;
            }
        },

        /**
         * Gets the Timeline widget.
         * @memberof Viewer
         * @type {Timeline}
         */
        timeline : {
            get : function() {
                return this._timeline;
            }
        },

        /**
         * Gets the FullscreenButton.
         * @memberof Viewer
         * @type {FullscreenButton}
         */
        fullscreenButton : {
            get : function() {
                return this._fullscreenButton;
            }
        },

        /**
         * Gets the DataSourceBrowser.
         * @memberof Viewer
         * @type {DataSourceBrowser}
         */
        dataSourceBrowser : {
            get : function() {
                return this._dataSourceBrowser;
            }
        },

        /**
         * Gets the display used for {@link DataSource} visualization.
         * @memberof Viewer
         * @type {DataSourceDisplay}
         */
        dataSourceDisplay : {
            get : function() {
                return this._dataSourceDisplay;
            }
        },

        /**
         * Gets the set of {@link DataSource} instances to be visualized.
         * @memberof Viewer
         * @type {DataSourceCollection}
         */
        dataSources : {
            get : function() {
                return this._dataSourceCollection;
            }
        },

        /**
         * Gets the canvas.
         * @memberof Viewer
         * @returns {Canvas} The canvas.
         */
        canvas : {
            get : function() {
                return this._cesiumWidget.canvas;
            }
        },

        /**
         * Gets the Cesium logo element.
         * @memberof Viewer
         * @returns {Element} The logo element.
         */
        cesiumLogo : {
            get : function() {
                return this._cesiumWidget.cesiumLogo;
            }
        },

        /**
         * Gets the scene.
         * @memberof Viewer
         * @returns {Scene} The scene.
         */
        scene : {
            get : function() {
                return this._cesiumWidget.scene;
            }
        },

        /**
         * Gets the primary central body.
         * @memberof Viewer
         * @returns {CentralBody} The primary central body.
         */
        centralBody : {
            get : function() {
                return this._cesiumWidget.centralBody;
            }
        },

        /**
         * Gets the clock.
         * @memberof Viewer
         * @returns {Clock} the clock
         */
        clock : {
            get : function() {
                return this._cesiumWidget.clock;
            }
        },

        /**
         * Gets the scene transitioner.
         * @memberof Viewer
         * @returns {SceneTransitioner} The scene transitioner.
         */
        sceneTransitioner : {
            get : function() {
                return this._cesiumWidget.sceneTransitioner;
            }
        },

        /**
         * Gets the screen space event handler.
         * @memberof Viewer
         * @returns {ScreenSpaceEventHandler}
         */
        screenSpaceEventHandler : {
            get : function() {
                return this._cesiumWidget.screenSpaceEventHandler;
            }
        },
    });

    /**
     * @memberof Viewer
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    Viewer.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the  widget.  Should be called if permanently
     * removing the widget from layout.
     * @memberof Viewer
     */
    Viewer.prototype.destroy = function() {
        this._container.removeChild(this._viewerContainer);
        this._viewerContainer.removeChild(this._toolbar);

        if (typeof this._homeButton !== 'undefined') {
            this._homeButton = this._homeButton.destroy();
        }

        if (typeof this._sceneModePicker !== 'undefined') {
            this._sceneModePicker = this._sceneModePicker.destroy();
        }

        if (typeof this._baseLayerPicker !== 'undefined') {
            this._baseLayerPicker = this._baseLayerPicker.destroy();
        }

        if (typeof this._animation !== 'undefined') {
            this._viewerContainer.removeChild(this._animation.container);
            this._animation = this._animation.destroy();
        }

        if (typeof this._timeline !== 'undefined') {
            this._timeline.removeEventListener('settime', onTimelineScrubfunction, false);
            this._viewerContainer.removeChild(this._timeline.container);
            this._timeline = this._timeline.destroy();
        }

        if (typeof this._fullscreenButton !== 'undefined') {
            this._viewerContainer.removeChild(this._fullscreenButton.container);
            this._fullscreenButton = this._fullscreenButton.destroy();
        }

        if (typeof this._dataSourceBrowser !== 'undefined') {
            this._viewerContainer.removeChild(this._dataSourceBrowser.container);
            this._dataSourceBrowser = this._dataSourceBrowser.destroy();
        }

        this._cesiumWidget.clock.onTick.removeEventListener(this._onTick, this);
        this._cesiumWidget = this._cesiumWidget.destroy();
        this._dataSourceDisplay = this._dataSourceDisplay.destroy();

        if (typeof this._dataSourceCollection.destroy === 'function') {
            this._dataSourceCollection = this._dataSourceCollection.destroy();
        }

        return destroyObject(this);
    };

    Viewer.prototype._onTick = function(clock) {
        var currentTime = clock.currentTime;
        this._dataSourceDisplay.update(currentTime);
    };

    return Viewer;
});