/* custom timedimension control */

/* update_chart: manipulate the chart based on the supplied date. mostly this means manipulating the geom opacity. will inject into the timedimension code (can't see an event to use!) */
var chart_loaded = false;
function update_chart(date) {
  // bail out if the chart isn't ready
  if (!chart_loaded) return;

  /* the svg export process uses a random number. need to update it if I
     re-export the file from r!
     
     each bar has '.n' appended to the group root id, but i've also garnished
     each with data attributes, as well as a css class distinguishing pos. and
     neg. bars */
  var svg_root = document.getElementById('ts_chart').contentDocument,
      root_seed = '65',
      geom_root_id = 'geom_rect.rect.' + root_seed + '.1',
      current_year = moment(date).year(),
      bar_count = svg_root.getElementById(geom_root_id).childElementCount;
  console.log('Updating chart... current year = ' + current_year);

  /* geom series adds '.n' to the root node id, where n is the year number (1:n)   this would prolly be easier if i'd grid.garnish()ed the svg... */

  // show the past and present years; hide the future ones
  for (i = 1; i <= bar_count; i++) {
    var bar_i = svg_root.getElementById(geom_root_id + '.' + i);
    if (parseInt(bar_i.getAttribute('data-year')) < current_year)
      bar_i.classList.remove('toggled_off');
    else
      bar_i.classList.add('toggled_off');
  }
}

L.Control.TimeDimensionCustom = L.Control.TimeDimension.include({
  /* override getDisplayDateFormat to only output UTC year and onth */
  _getDisplayDateFormat: function(date) {
    var month_names = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return (
      month_names[date.getUTCMonth()] + ' ' +
      date.getUTCFullYear().toString());
  },

  /* overriding update basically only so i can update my story bit bar with
     animations */
  _update: function() {
    if (!this._timeDimension) {
      return;
    }
    if (this._timeDimension.getCurrentTimeIndex() >= 0) {
      var date = new Date(this._timeDimension.getCurrentTime());
      if (this._displayDate) {
        L.DomUtil.removeClass(this._displayDate, 'loading');
        this._displayDate.innerHTML = this._getDisplayDateFormat(date);
        // also (sneakily) update my story element!
        document.getElementById('story-bitbar-td').innerHTML =
          this._getDisplayDateFormat(date);
        // may also need to update my SVG chart here?
        update_chart(date);
      }
      if (this._sliderTime && !this._slidingTimeSlider) {
        this._sliderTime.setValue(this._timeDimension.getCurrentTimeIndex());
      }
    } else {
      if (this._displayDate) {
        this._displayDate.innerHTML = this._getDisplayNoTimeError();
      }
    }
  },

  /* override for fluid slider width */
  _createSliderTime: function(className, container) {
    var sliderContainer,
      sliderbar,
      max,
      knob, limits;
    sliderContainer = L.DomUtil.create('div', className, container);
    /*L.DomEvent
        .addListener(sliderContainer, 'click', L.DomEvent.stopPropagation)
        .addListener(sliderContainer, 'click', L.DomEvent.preventDefault);*/

    sliderbar = L.DomUtil.create('div', 'slider', sliderContainer);
    max = this._timeDimension.getAvailableTimes().length - 1;

    if (this.options.limitSliders) {
      limits = this._limitKnobs = this._createLimitKnobs(sliderbar);
    }
    knob = new L.UI.Knob(sliderbar, {
      className: 'knob main',
      rangeMin: 0,
      rangeMax: max
    });
    knob.on('dragend', function(e) {
      var value = e.target.getValue();
      this._sliderTimeValueChanged(value);
      this._slidingTimeSlider = false;
    }, this);
    knob.on('drag', function(e) {
      this._slidingTimeSlider = true;
      var time = this._timeDimension.getAvailableTimes()[e.target.getValue()];
      if (time) {
        var date = new Date(time);
        if (this._displayDate) {
          this._displayDate.innerHTML = this._getDisplayDateFormat(date);
        }
        if (this.options.timeSliderDragUpdate){
          this._sliderTimeValueChanged(e.target.getValue());
        }
      }
    }, this);

    knob.on('predrag', function() {
      var minPosition, maxPosition;
      if (limits) {
        //limits the position between lower and upper knobs
        minPosition = limits[0].getPosition();
        maxPosition = limits[1].getPosition();
        if (this._newPos.x < minPosition) {
          this._newPos.x = minPosition;
        }
        if (this._newPos.x > maxPosition) {
          this._newPos.x = maxPosition;
        }
      }
    }, knob);
    L.DomEvent.on(sliderbar, 'click', function(e) {
      if (L.DomUtil.hasClass(e.target, 'knob')) {
        return; //prevent value changes on drag release
      }
      var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
        x = L.DomEvent.getMousePosition(first, sliderbar).x;
      if (limits) { // limits exits
        if (limits[0].getPosition() <= x && x <= limits[1].getPosition()) {
          knob.setPosition(x);
          this._sliderTimeValueChanged(knob.getValue());
        }
      } else {
        knob.setPosition(x);
        this._sliderTimeValueChanged(knob.getValue());
      }

    }, this);

    /* my addition: on map resize, recalculate slider and knob. can assume a
        map b/c this fn gets called by onAdd */
    L.DomEvent.on(this._map, 'resize', function() {
      if (limits) {
      var lknob = limits[0],
          uknob = limits[1],
          lknob_value = lknob.getValue(),
          uknob_value = uknob.getValue(),
          knob_value = knob.getValue();

      // order of knob/bar movement should be fine regardless of direction
      sliderbar.style.width =
          L.DomUtil.getStyle(sliderContainer, 'width');
      knob.setValue(knob_value);
      lknob.setValue(lknob_value);
      uknob.setValue(uknob_value);

      // range bar?
      var rangebar;
      for (i = 0; i < sliderbar.children.length; i++) {
          if (sliderbar.children[i].classList.contains('range'))
            rangebar = sliderbar.children[i];
      }
      L.DomUtil.setPosition(rangebar, L.point(lknob.getPosition(), 0));
      rangebar.style.width =
          uknob.getPosition() - lknob.getPosition() + 'px';
      } else {
      var knob_value = knob.getValue();
      sliderbar.style.width =
          L.DomUtil.getStyle(sliderContainer, 'width');
      knob.setValue(knob_value);
      }
    }, this);
        
    knob.setPosition(0);
    return knob;
  },

  /* also override so that i can resize the fixed width on page load */
  addTo: function() {
    //To be notified AFTER the component was added to the DOM
    L.Control.prototype.addTo.apply(this, arguments);

    // get handles to the slider container and rangebar
    // via the entire control's container
    var sliderContainer, sliderbar;
    for (i = 0; i < this._container.children.length; i++) {
      if (this._container.children[i].classList.contains('timecontrol-slider'))
      {
        sliderContainer = this._container.children[i];
        sliderbar = sliderContainer.firstChild;
      }
    }

    if (this._limitKnobs) {
      var lknob = this._limitKnobs[0],
        uknob = this._limitKnobs[1],
        knob = this._sliderTime,
        lknob_value = lknob.getValue(),
        uknob_value = uknob.getValue(), 
        knob_value = knob.getValue();
        
      // order of knob/bar movement should be fine regardless of direction
      sliderbar.style.width =
        L.DomUtil.getStyle(sliderContainer, 'width');
      knob.setValue(knob_value);
      lknob.setValue(lknob_value);
      uknob.setValue(uknob_value);
      
      // get handle to range bar, then update that too
      var rangebar;
      for (i = 0; i < sliderbar.children.length; i++) {
        if (sliderbar.children[i].classList.contains('range'))
          rangebar = sliderbar.children[i];
      }
      L.DomUtil.setPosition(rangebar, L.point(lknob.getPosition(), 0));
      rangebar.style.width =
        uknob.getPosition() - lknob.getPosition() + 'px';

    } else {
      var knob = this._sliderTime,
        knob_value = knob.getValue();
      sliderbar.style.width =
        L.DomUtil.getStyle(sliderContainer, 'width');
      knob.setValue(knob_value);
    }

    this._onPlayerStateChange();
    this._onTimeLimitsChanged();
    this._update();
    return this;
  }
});

L.Map.addInitHook(function() {
  if (this.options.timeDimensionControl) {
    this.timeDimensionControl =
      new L.Control.TimeDimensionCustom(
        this.options.timeDimensionControlOptions || {});
    // this.addControl(this.timeDimensionControl);
  }
});
