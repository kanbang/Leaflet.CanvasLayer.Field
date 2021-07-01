/**
 * Animated VectorField on canvas
 */
L.CanvasLayer.VectorFieldAnim = L.CanvasLayer.Field.extend({
    options: {
        paths: 800,
        color: 'white', // html-color | function colorFor(value) [e.g. chromajs.scale]
        width: 1.0, // number | function widthFor(value)
        fade: 0.96, // 0 to 1
        duration: 20, // milliseconds per 'frame'
        maxAge: 200, // number of maximum frames per path
        velocityScale: 1 / 5000
    },

    initialize: function (vectorField, options) {
        L.CanvasLayer.Field.prototype.initialize.call(
            this,
            vectorField,
            options
        );
        L.Util.setOptions(this, options);

        this.timer = null;
        this.ctx = null;
        this.paths = [];
        this.viewInfo = null;
        this.running = true;
    },

    onLayerDidMount: function () {
        L.CanvasLayer.Field.prototype.onLayerDidMount.call(this);
        this._map.on('move resize', this._stopAnimation, this);
    },

    onLayerWillUnmount: function () {
        L.CanvasLayer.Field.prototype.onLayerWillUnmount.call(this);
        this._map.off('move resize', this._stopAnimation, this);
        this._stopAnimation();
    },

    _hideCanvas: function _showCanvas() {
        L.CanvasLayer.Field.prototype._hideCanvas.call(this);
        this._stopAnimation();
    },

    onDrawLayer: function (viewInfo) {

        this.viewInfo = viewInfo;
        this.running = true;

        if (!this._field || !this.isVisible()) return;

        this._updateOpacity();
        if (!this.ctx) {
            this.ctx = this._getDrawingContext();
        }

        // 清空画布痕迹
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);


        // TODO 应该只执行一次，后面只修改数据

        if (this.paths.length == 0) {
            this.paths = this._prepareParticlePaths();
        }

        if (!this.timer) {
            this.timer = d3.timer(() => {
                if (this.running) {
                    this._moveParticles();
                    this._drawParticles();
                }
            }, this.options.duration);
        }

    },


    /**
     * Builds the paths, adding 'particles' on each animation step, considering
     * their properties (age / position source > target)
     */
    _moveParticles: function () {
        // let screenFactor = 1 / self._map.getZoom(); // consider using a 'screenFactor' to ponderate velocityScale
        this.paths.forEach((par) => {
            if (par.age > this.options.maxAge) {
                // restart, on a random x,y
                par.age = 0;
                this._field.randomPosition(par);
            }

            let vector = this._field.valueAt(par.x, par.y);
            if (vector === null) {
                par.age = this.options.maxAge;
            } else {
                // the next point will be...
                let xt = par.x + vector.u * this.options.velocityScale; //* screenFactor;
                let yt = par.y + vector.v * this.options.velocityScale; //* screenFactor;

                if (this._field.hasValueAt(xt, yt)) {
                    par.xt = xt;
                    par.yt = yt;
                    par.m = vector.magnitude();
                } else {
                    // not visible anymore...
                    par.age = this.options.maxAge;
                }
            }
            par.age += 1;
        });
    },

    /**
     * Draws the paths on each step
     */
    _drawParticles: function () {
        // Previous paths...
        let prev = this.ctx.globalCompositeOperation;
        this.ctx.globalCompositeOperation = 'destination-in';
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        //this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalCompositeOperation = prev;

        // fading paths...
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.options.fade})`;
        this.ctx.lineWidth = this.options.width;
        this.ctx.strokeStyle = this.options.color;

        // New paths
        this.paths.forEach((par) => {
            this._drawParticle(this.viewInfo, this.ctx, par);
        });
    },

    _drawParticle: function (viewInfo, ctx, par) {
        let source = new L.latLng(par.y, par.x);
        let target = new L.latLng(par.yt, par.xt);

        if (
            viewInfo.bounds.contains(source) &&
            par.age <= this.options.maxAge
        ) {
            let pA = viewInfo.layer._map.latLngToContainerPoint(source);
            let pB = viewInfo.layer._map.latLngToContainerPoint(target);

            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);

            // next-step movement
            par.x = par.xt;
            par.y = par.yt;

            // colormap vs. simple color
            let color = this.options.color;
            if (typeof color === 'function') {
                ctx.strokeStyle = color(par.m);
            }

            let width = this.options.width;
            if (typeof width === 'function') {
                ctx.lineWidth = width(par.m);
            }

            ctx.stroke();
        }
    },

    _prepareParticlePaths: function () {
        let paths = [];

        for (var i = 0; i < this.options.paths; i++) {
            let p = this._field.randomPosition();
            p.age = this._randomAge();
            paths.push(p);
        }
        return paths;
    },

    _randomAge: function () {
        return Math.floor(Math.random() * this.options.maxAge);
    },

    _stopAnimation: function () {
        this.running = false;
        // if (this.timer) {
        //     this.timer.stop();
        //     this.timer = null;
        // }
    }
});

L.canvasLayer.vectorFieldAnim = function (vectorField, options) {
    return new L.CanvasLayer.VectorFieldAnim(vectorField, options);
};