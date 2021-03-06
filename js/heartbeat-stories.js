/* blah */

// var story_popup_options = {
//   autoPan: false,
//   closeButton: false,
//   closeOnEscapeKey: false,
//   closeOnClick: false,
//   className: 'story_popup'
// }

// initialise timedimension and associated control + player
// (but don't attach to the map yet)
var td = new L.TimeDimension({
  timeInterval: '1951-01-01T00:00:00.000Z/2017-12-01T00:00:00.000Z',
  period: 'P1M'
});
var td_player = new L.TimeDimension.Player({
  buffer: 5,     // control to taste
  loop: true,
  transitionTime: 250,
  startOver: true
}, td);
var td_control = new L.Control.TimeDimension({
  position: 'bottomleft',
  speedSlider: false,
  limitSliders: true,
  player: td_player
});

// TODO - start turning this into proper example stories!

var story_popup_opts = {
  maxWidth: 400,
  autoPan: false,
  // offset: Point(0, 7)   // might be good for controlling pos better!
  closeButton: false,
  autoClose: false,
  closeOnEscapeKey: false,
  closeOnClick: false,
  className: 'story-popup'
}

var time_suffix = '-01-01T00:00:00.000Z';

// base options for all geoserver wms requests
var geoserver_base = 'https://climdex.org/geoserver/showcase/wms?';
var geoserver_options = {
  service: 'WMS',
  version: '1.1.0',
  request: 'GetMap',
  srs: 'EPSG:4326',
  format: 'image/png',
  className: 'blend_multiply',
  transparent: true,
  updateWhenIdle: false
};

var heartbeat_stories = [


  // animated storybit test
  L.story(
    [
      L.storyBit.animated(td_player,
        {
          baselayer_label: 'Summer nights: series',
          baselayer:
            L.timeDimension.layer.wms(
              L.tileLayer.wms(
                geoserver_base, L.extend({
                  layers: 'SU_ann_series',
                  env: 'low:10;high:366',
                  leg_units: 'days/yr',
                  bounds: [[-10, 112], [-45, 154]]
                }, geoserver_options)),
              { cache: 804 }),
          time_start: '1951' + time_suffix,
          time_end: '2017' + time_suffix,
          movements: [
            {
              by: [0, 50],
              options: { duration: 10 }
            }
          ],
          annotations: [
            {
              type: 'comment', when: 3,
              content: 'Climate change is a <span class="emph">global</span> phenomenon.'
            },
            {
              type: 'comment', when: 4,
              content: 'But not all places are affected equally.'
            },
            {
              type: 'clear_comments', when: 6
            },
            {
              type: 'comment', when: 6.5,
              content: 'Our hottest days have become <span class="emph">hotter...</span>'
            },
            {
              type: 'comment', when: 7.5,
              content: '... but not in the American mid-west.'
            },
            {
              type: 'comment', when: 8.5,
              content: 'There\'re a few reasons for this. <a href="http://dx.doi.org/10.1016/j.wace.2018.01.001">Read the paper.</a>'
            }
          ],
          end_pause: 1//,
        })
    ],
    {
      name: 'Heartbeat: nights',
      description: '...',
      selectable: true,
      at: [[-10, 112], [-45, 154]],
      padding_topleft: dynamic_padding_tl,
      padding_bottomright: [0, 0]
    })
  ];

/* cleanup_for_stories: prep the ui for story mode (disable existing base
   layers, turn off story menu, wipe time cache).
   attach to storyloading events. */
function cleanup_for_story(story) {
  $('#map-blackout').one('transitionend', function() {
    console.log('#map-blackout transitionend handler');
    turn_data_off();
    turn_stories_list_off();
    wipe_time_cache();
    $('#story-bitbar').addClass('toggled_on');
    story.play();
    console.log('#map-blackout transitionend handler DONE');
  }).addClass('toggled_on');
}

function storybit_ready() {
  console.log('storybitready handler');
  console.log(this._storybits[this._current_storybit]._baselayer_label);
  $('#story-bitbar-label')
    .html(this._storybits[this._current_storybit]._baselayer_label)
    .addClass('toggled_on');
  // also turn the year indicator on if it's animated
  if (this._storybits[this._current_storybit] instanceof L.StoryBit.Animated)
    $('#story-bitbar-td').removeClass('disabled');
  $('#map-blackout').removeClass('toggled_on');
}

function storybit_wrapup() {
  console.log('storybitend handler');
  legend.update('img/1x1.png');
  $('#story-bitbar').one('transitionend', function() {
    $('#story-bitbar-label').html('');
    $('#story-bitbar-td').addClass('disabled');
  }).removeClass('toggled_on');
}

/* dynamic_padding_tl: calculates padding for the story movements based on the
   window's aspect ratio at the time (eg. device rotation mid-story).
   compensates for the 50px header bar to match css styling */
function dynamic_padding_tl(map) {
  var map_size = map.getSize(),
      aspect = map_size.x / (map_size.y + 50);
  console.log('map size: ' + map_size.x + ', ' + map_size.y);
  console.log('Apect ratio: ' + aspect);
  return aspect <= 1.25 ?                             // max aspect ratio
    [0,              ((map_size.y - 50) / 2) + 50] :  // portrait padding
    [map_size.x / 2, 50]                              // landscape padding
}

/* getRandomInt: helper for getting random stories */
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

/* random_story: load a random story */
function random_story() {
  app_mode = 'shuffle';
  heartbeat_stories[getRandomInt(heartbeat_stories.length)].load();
}

/* update_legend: update legend according to storybit baselayer*/
function update_legend(bit) {
  
  // undefined or non-wms baselayer: just use a blank legend
  if (bit._baselayer === undefined)
    legend.update('img/1x1.png');
  else if (
    !(bit._baselayer instanceof L.TimeDimension.Layer.WMS) &&
    !(bit._baselayer instanceof L.TileLayer.WMS))
    legend.update('img/1x1.png');
  else {
    // wms legend: calculate the legend labels + url and update 
    console.log(bit);
    var param_root;
    if (bit._baselayer instanceof L.TimeDimension.Layer.WMS)
      param_root = bit._baselayer._baseLayer.wmsParams;
    else if (bit._baselayer instanceof L.TileLayer.WMS)
      param_root = bit._baselayer.wmsParams;

    var lab_env = param_root.env,
        lab_units = param_root.leg_units,
        env_bits = lab_env.split(/:|;/),
        lab_low = env_bits[1] + ' ' + lab_units,
        lab_high = env_bits[env_bits.length - 1] + ' ' + lab_units,
        layers = param_root.layers;
    legend.update(legend_url + layers, lab_low, lab_high);
  }
}
