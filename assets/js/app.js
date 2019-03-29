/* global L */ // Leaflet global alias L
/* global $ */ // jQuery global alias $
var uhf = '';

// Define function createMap() to instantiate Leaflet map
function createMap () {
  // Mapbox tile layer
  var satellite = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    // attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.satellite',
    accessToken: 'pk.eyJ1IjoiY2hhZGxhd2xpcyIsImEiOiJlaERjUmxzIn0.P6X84vnEfttg0TZ7RihW1g'
  });

  // Carto tile layer
  var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    // attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });

  // Create the map
  var map = L.map('map', {
    attributionControl: false, // add custom attribution control below
    center: [40.73, -73.88], // lat, lon (hash URL displays /#zoom/lat/lon)
    // layers: [positron, uhfPoints],
    layers: positron,
    minZoom: 10,
    zoom: 11,
    zoomControl: false // replaced with leaflet.zoomhome plugin zoom control below
  });

  map.createPane('polygonsPane');
  map.getPane('polygonsPane').style.zIndex = 300;
  // console.log('map.getPane(polygonsPane):', map.getPane('polygonsPane'));

  // Create empty layerGroup object assigned to uhfPolygons
  var uhfPolygons = new L.LayerGroup();
  // console.log('uhfPolygons pre-function', uhfPolygons);
  getUhfPolygons(uhfPolygons);
  // console.log('uhfPolygons post-function', uhfPolygons);

  var attribution = L.control.attribution({
    position: 'bottomright',
    prefix: false
  });

  // Add attribution control with custom attribution
  attribution.addAttribution('<a href="https://chadlawlis.com">Chad Lawlis</a> | <a href="https://leaflet.com">Leaflet</a> | NYC data &copy; <a href="https://www1.nyc.gov/">NYC</a>, Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Base &copy; <a href="https://carto.com/attributions">CARTO</a>, Imagery &copy; <a href="https://mapbox.com/">Mapbox</a>');
  attribution.addTo(map);

  // Add home button with zoom controls via zoomhome plugin
  // https://github.com/torfsen/leaflet.zoomhome
  var zoomHome = L.Control.zoomHome();
  zoomHome.addTo(map);

  // Tilesets for layer control
  var tilesets = {
    'Base': positron,
    'Satellite': satellite
  };

  // Overlay for layer control
  var overlay = {
    // 'Points': uhfPoints,
    'Boundaries': uhfPolygons
  };

  // Note: can remove "overlay" to only provide option of switching between basemaps
  L.control.layers(tilesets, overlay, {position: 'topleft'}).addTo(map);
  console.log('layers control added to map');

  getData(map);
}

function getUhfPolygons (uhfPolygons) {
  $.ajax('assets/data/uhf42_polygons.geojson', {
    dataType: 'json',
    success: function (response) {
      var polygonStyle = {
        color: '#6b757f', // stroke color; default: #3388ff
        fillColor: '#efefef', // default: #3388ff
        fillOpacity: 0.4,
        opacity: 0.4, // stroke opacity
        weight: 2 // stroke weight
      };
      L.geoJSON(response, {
        onEachFeature: onEachFeature,
        pane: 'polygonsPane',
        style: polygonStyle
      }).addTo(uhfPolygons);
    }
  });
}

// Use onEachFeature() function on AJAX data to attach a popup to features when they are clicked
function onEachFeature (feature, layer) {
// Replace popupContent property from Leaflet onEachFeature example with variable storing HTML string with all feature properties
  var popupContent = '<p><b>' + feature.properties.uhf_name + '</p></b><p>Borough: ' + feature.properties.borough + '</p>';
  layer.bindPopup(popupContent);
}

// Define getData() function to retrieve and display data
// Passes AJAX response data to createPropSymbols() function to create circle markers
function getData (map) {
  $.ajax('assets/data/uhf42_points.geojson', {
    dataType: 'json',
    success: function (response) {
      // Create variable "attributes" (allowing use in other functions) to hold Feature attributes array
      var attributes = processData(response);
      // Pass AJAX response data, map, and attributes to createPropSymbols() function to create proportional vector circleMarkers
      createPropSymbols(response, map, attributes);
      // Pass map and attributes to createSequenceControls() function
      createSequenceControls(map, attributes);
      createPanel(map, attributes);
      createLegend(map, attributes);
    }
  });
}

// Build attributes array from AJAX response data
function processData (data) {
  // Create empty array to hold attributes
  var attributes = [];
  // Grab the properties of the first Feature in the response data
  var properties = data.features[0].properties;
  // Loop through Feature properties to push attribute name into at attributes array
  for (var attribute in properties) {
    // indexOf() method returns the first index at which a given element can be found in the array, -1 if it cannot be found
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexof
    // If attribute name includes 'a_rate_uhf_' then push attribute name into attributes array
    // i.e., the neighborhood-wide asthma rates across age groups that the proportional symbols will be calculated from and the sequence controls will use
    if (attribute.indexOf('a_rate_uhf_') > -1) {
      attributes.push(attribute);
    }
  }
  console.log('return attributes from processData():', attributes);
  return attributes;
}

// Add circle markers for Point Features to the map
// "data" parameter will use AJAX response data from getData() function
function createPropSymbols (data, map, attributes) {
  // Create Leaflet GeoJSON layer and add it to the map
  L.geoJSON(data, {
    // L.geoJSON's pointToLayer option's anonymous function iterates through each Feature,
    //   allowing access to each Feature's set of attributes
    // It expects to be returned a Leaflet layer
    pointToLayer: function (feature, latlng) {
      // Add the pointToLayer() function to return statement (instead of just "pointToLayer"),
      //   which allows specifying the parameters to be passed to pointToLayer() function
      //   (feature, latlng) by default; need to pass "attributes" as well to allow spawning of Leaflet layers
      //   depending on the index of the attribute from sequence interaction (moving the slider, clicking reverse/forward buttons)
      return pointToLayer(feature, latlng, attributes);
    }
  // Add circleMarkers to map
  }).addTo(map);
}

// Convert default raster markers to vector circleMarkers
// sized proportionally by attribute value, with interactivity
function pointToLayer (feature, latlng, attributes) {
  // Assign sixth attribute to be symbolized on page landing ("a_rate_uhf_2010")
  var attribute = attributes[0];

  console.log('var attribute = attributes[0] from pointToLayer:', attribute);

  // Store circleMarker options in local "options" variable, to be passed when instantiating circleMarkers below
  var options = {
    color: '#6b6b7f', // stroke color // #ff7800 from lab module
    fillColor: '#6b6b7f', // consider color on theme with Positron e.g. #fagaf8 // #ff7800 from lab module
    fillOpacity: 0.6,
    opacity: 1, // stroke opacity
    weight: 1 // stroke weight
    // attribution: ''
  };

  // Get the value of the corresponding attribute
  // In this case, from the sixth attribute in the attributes array, i.e., "a_rate_uhf_2010"
  var attValue = Number(feature.properties[attribute]);
  console.log('attValue from pointToLayer:', attValue);

  // Pass the attribute value to the calcPropRadius() function to calculate each Feature's radius value
  // proportional to its attribute value
  options.radius = calcPropRadius(attValue);

  // Add Features as vector circleMarkers, sized proportional to "a_rate_uhf_2010" attribute value
  var layer = L.circleMarker(latlng, options);

  // Pass Feature properties, attribute name (a_rate_uhf_2010), circleMarkers layer, and Feature circleMarker radius
  // to Popup constructor function to create interactivity content (tooltips via popupContent and panel information via panelContent)
  var popup = new Popup(feature.properties, attribute, layer, options.radius);

  // Add tooltips to circleMarkers
  popup.bindToLayer();

  // Add event listeners
  popup.listener();

  return layer;
}

// Calculate the radius of each proportional symbol (circleMarker) based on the attribute value of each Feature
function calcPropRadius (attValue) {
  // Scale factor to adjust symbol size evenly
  var scaleFactor = 25;
  // Circle area calculated by attribute value multiplied by scaleFactor
  var area = attValue * scaleFactor;
  // Circle radius calculated by square root of area divided by pie
  var radius = Math.sqrt(area / Math.PI);
  return radius;
}

// Using an object-oriented approach, via constructor function, to replace earlier createPopup() function
// Assign each variable as a property of the Popup object
function Popup (properties, attribute, layer, radius) {
  this.properties = properties;
  this.attribute = attribute; // "a_rate_uhf_2010"
  this.layer = layer;
  this.uhfCode = this.properties.uhf_code;
  this.uhfName = this.properties.uhf_name;
  this.borough = this.properties.borough;
  this.aRateUhf = this.properties[attribute];
  this.year = attribute.split('_')[3]; // "a_rate_uhf_2010" -> "2010"
  this.minorityRate = Math.round((this.properties.minority_pct * 100));
  this.povertyRate = Math.round(this.properties.poverty_pop_pct);

  var aRateUhf0to4 = 'a_0to4_rate_' + attribute.split('_')[3];
  this.aRateUhf0to4 = this.properties[aRateUhf0to4];

  var aRateUhf5to17 = 'a_5to17_rate_' + attribute.split('_')[3];
  this.aRateUhf5to17 = this.properties[aRateUhf5to17];

  var aRateUhf18plus = 'a_18plus_rate_' + attribute.split('_')[3];
  this.aRateUhf18plus = this.properties[aRateUhf18plus];

  var aRateCityWide = 'a_rate_citywide_' + attribute.split('_')[3];
  this.aRateCityWide = this.properties[aRateCityWide];

  // HTML string for use in tooltip
  this.popupContent = '<h3>' + this.uhfName + '</h3>';
  // HTML string for use as panel content
  this.panelContent = '<h2>' + this.uhfName + '</h2><h1>' + this.aRateUhf + '</h1><p><b>City-wide:</b> ' + this.aRateCityWide + '</p><p><b>Minority:</b> ' + this.minorityRate + '%</p><p><b>Poverty:</b> ' + this.povertyRate + '%</p>';

  // Log "this.panelContent" for event listener troubleshooting
  // console.log(this.panelContent);

  // Assign bindToLayer method of the Popup constructor
  // which binds the popupContent to the circleMarker layer
  this.bindToLayer = function () {
    // console.log('this.properties via bindToLayer:', this.properties);
    this.layer.bindPopup(this.popupContent, {
      // Add an offset to the tooltip position, setting its anchor to appear above the circleMarker
      // https://leafletjs.com/reference-1.4.0.html#popup-offset
      offset: new L.Point(0, -radius),
      // Do not include close button "X" in upper-right corner of tooltip
      closeButton: false
    });
  };

  // Assign keyword "this" to local variable "self" in order to access the constructor object properties in the event handlers
  // Otherwise, keyword "this" references the properties of the element on which the event was fired
  // (i.e., the immediate parent of the object, as expected)
  // https://stackoverflow.com/questions/12731528/adding-event-listeners-in-constructor#12731581
  // See Lab Module 1-3 Lesson 1 under Example 1.4 for further description of keyword "this"
  var self = this;

  // Assign listener method for event listener functions, to avoid redundancy of writing same code block to both pointToLayer() and updatePropSymbols()
  // Call listener method in both pointToLayer() and updatePropSymbols() functions, (sequentially below calling bindToLayer),
  // to establish interactivity (tooltips + panel content) on circleMarker layer being added to the map, via pointToLayer(),
  // and after attribute update, via updatePropSymbols()
  // Outside the event listener, keyword "this" still accesses constructor function object
  this.listener = function () {
    // Successfully logs this.properties
    // console.log('this.properties via initial listener():', this.properties);
    // Successfully logs self.properties too
    // console.log('self.properties via initial listener():', self.properties);
    this.layer.on({
      // On mouseover (i.e., hover) over circleMarkers
      mouseover: function () {
        // "this.properties" undefined starting here, given "this" refers to the element that the event was added to (in this case, the circleMarker)
        // console.log('this.properties via listener() mouseover:', this.properties);
        // thus the assignment to "self" to bring the constructor function object into the event handlers
        // console.log('self.properties via listener() mouseover:', self.properties);

        // Update city value based on City value of last circleMarker moused over
        // (which allows updatePanelContent() function to update panel HTML content for new attribute on skip click or slider interaction)
        uhf = self.uhfName;
        // Still need to use "this.openPopup" here because it is a Leaflet function on circleMarker
        // "self.openPopup" throws error as not a function
        this.openPopup(); // https://leafletjs.com/reference-1.4.0.html#layer-openpopup
        // Thicken circleMarker stroke to provide stronger visual affordance
        self.layer.setStyle({weight: 3});
        // Set panel HTML content using respective Feature's panelContent property defined above
        $('#panel-injected').html(self.panelContent);
      },
      // On mouseout from circleMarkers
      mouseout: function () {
        // Using "this.closePopup" for same reason as "this.openPopup" above
        this.closePopup(); // https://leafletjs.com/reference-1.4.0.html#layer-closepopup
        // Reset to default circleMarker stroke
        self.layer.setStyle({weight: 1});
        // $('#panel').empty(); // remove child nodes of matched elements (i.e., remove panelContent from div id='panel' on mouseout from circleMarker)
      },
      // Add click for mobile
      click: function () {
        // Set panel HTML content using respective Feature's panelContent property defined above
        // Included here strictly for mobile/touch, given no "mouseover" functionality
        $('#panel-injected').html(self.panelContent);
      }
    });
  };
}

// Function to create sequence controls (slider)
function createSequenceControls (map, attributes) {
  var SequenceControl = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    // OLD "onAdd" procedural code; stop propagation implementation does not work (from Lab Module 1-3 Lesson 2 Example 2.5)
    // See below commented block for OOP refactored code with functional stop propagation implementation
    // onAdd: function (map) {
    //   // https://leafletjs.com/reference-1.4.0.html#domutil-create
    //   var sequenceContainer = L.DomUtil.create('div', 'sequence-control-container');
    //
    //   // Add reverse button before slider so it sits to the left of the slider
    //   // Use the same class "skip" for both buttons (reverse + forward) to style together
    //   // Use different id's "reverse" and "forward" to style individually and attach individual event listeners
    //   $(sequenceContainer).append('<button class="skip" id="reverse"><i class="fas fa-chevron-circle-left"></i></button>');
    //
    //   // Create <input> element of type "range" which creates slider
    //   // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
    //   // Include class "range-slider" for manipulation
    //   // The <input> element fires an "input event" when moved
    //   $(sequenceContainer).append('<input type="range" class="range-slider">');
    //
    //   // Add skip (forward) button after slider so it sits to the right of the slider
    //   $(sequenceContainer).append('<button class="skip" id="forward"><i class="fas fa-chevron-circle-right"></i></button>');
    //
    //   // https://api.jquery.com/mousedown/
    //   // https://api.jquery.com/dblclick/
    //   $(sequenceContainer).on('mousedown dblclick', function (e) {
    //     // https://leafletjs.com/reference-1.4.0.html#domevent-stoppropagation
    //     L.DomEvent.stopPropagation(e);
    //   });
    //
    //   return sequenceContainer;
    // }

    // "onAdd" code block above OOP refactored and stop propagation implementation fixed
    onAdd: function (map) {
      // https://leafletjs.com/reference-1.4.0.html#domutil-create
      this.sequenceContainer = L.DomUtil.create('div', 'sequence-control-container');

      // Add reverse button before slider so it sits to the left of the slider
      // Use the same class "skip" for both buttons (reverse + forward) to style together
      // Use different id's "reverse" and "forward" to style individually and attach individual event listeners
      $(this.sequenceContainer).append('<button class="skip" id="reverse"><i class="fas fa-chevron-circle-left"></i></button>');

      // Create <input> element of type "range" which creates slider
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
      // Include class "range-slider" for manipulation
      // The <input> element fires an "input event" when moved
      $(this.sequenceContainer).append('<input type="range" class="range-slider">');

      // Add skip (forward) button after slider so it sits to the right of the slider
      $(this.sequenceContainer).append('<button class="skip" id="forward"><i class="fas fa-chevron-circle-right"></i></button>');

      // Updated/functional implementation of disabling click propagation
      // https://stackoverflow.com/a/37629102
      // http://jsfiddle.net/s8q35xhu/3/
      L.DomEvent.disableClickPropagation(this.sequenceContainer);

      return this.sequenceContainer;
    }
  });

  map.addControl(new SequenceControl());

  $('.range-slider').attr({
    max: 5, // index of the last attribute (7 in total)
    min: 0, // index of the first attribute
    value: 0, // index of starting attribute; slider will start at first attribute in sequence
    step: 1 // increment by 1 with each sequence interaction
  });

  // Click listener for reverse/forward buttons
  $('.skip').click(function () {
    // Get the "old" index value of the slider (i.e., the index value when the button is clicked)
    var index = $('.range-slider').val();
    // Increment or decrement the index value, depending on the button clicked
    // If the element id is "forward" ...
    if ($(this).attr('id') === 'forward') {
      // ... then increment the index value
      index++;
      // If the index value exceeds 5 then "wrap around" to the first attribute (i.e., set the index value to 0)
      // Otherwise, maintain the incremented index value
      index = index > 5 ? 0 : index;
    // Else if the element id is "reverse" ...
    } else if ($(this).attr('id') === 'reverse') {
      // ... then decrement the index value
      index--;
      // If the index value is less than 0 then "wrap around" to the last attribute (i.e., set the index value to 5)
      // Otherwise, maintain the decremented index value
      index = index < 0 ? 5 : index;
    }
    // Update the index value of the slider accordingly (which will automatically update its position visually)
    $('.range-slider').val(index);

    // Log the index values from button clicks
    // console.log(index);

    // Clear panelContent on skip button click
    // $('#panel').empty();

    // Update panelContent using updated attribute from skip button click
    updatePanelContent(map, attributes[index]);

    // Pass new attribute name, based on index value, to updatePropSymbols() function to update circleMarkers accordingly
    // along with "map" parameter to allow adding to map
    updatePropSymbols(map, attributes[index]);
  });

  // Input listener for slider
  $('.range-slider').on('input', function () {
    // Retrieve the attribute index value after the slider has been changed using jQuery
    // "$(this)" references the element that fired the event (slider)
    // ".val()" retrieves the element's (slider's) current value
    var index = $(this).val();

    // Log the index values from slider sequence interactions
    // console.log(index);

    // Clear panelContent on slider interaction
    // $('#panel').empty();

    // Update panelContent using updated attribute from slider interaction
    updatePanelContent(map, attributes[index]);

    // Pass new attribute name, based on index value, to updatePropSymbols() function to update circleMarkers accordingly
    // along with "map" parameter to allow adding to map
    updatePropSymbols(map, attributes[index]);
  });
}

function updatePanelContent (map, attribute) {
  map.eachLayer(function (layer) {
    // Refine eachLayer() selection to only L.circleMarker layers
    // by testing for existence of a Feature in the layer AND the existence of the selected attribute in the layer's feature properties
    // AND selecting only the Feature with the City value matching the global variable "city" (which is updated on circleMarker mouseover)
    if (layer.feature && layer.feature.properties[attribute] && layer.feature.properties.uhf_name === uhf) {
      // Update panelContent HTML string accordingly
      var panelContent = '<h2>' + uhf + '</h2>';
      // var year = attribute.split('_')[3];
      var aRateCityWide = 'a_rate_citywide_' + attribute.split('_')[3];
      panelContent += '<h1>' + layer.feature.properties[attribute] + '</h1><p><b>City-wide:</b> ' + layer.feature.properties[aRateCityWide] + '</p><p><b>Minority:</b> ' + Math.round((layer.feature.properties['minority_pct'] * 100)) + '%</p><p><b>Poverty:</b> ' + layer.feature.properties['poverty_pop_pct'] + '%</p>';
      // Replace panel HTML with updated panelContent HTML string
      $('#panel-injected').html(panelContent);
    }
  });
}

// Resize proportional circleMarkers according to new attribute values
function updatePropSymbols (map, attribute) {
  // Use Leaflet's L.map() eachLayer() method to access all Leaflet layers currently on the map
  // These include L.tileLayer
  map.eachLayer(function (layer) {
    // Refine eachLayer() selection to only L.circleMarker layers
    // by testing for existence of a Feature in the layer AND the existence of the selected attribute in the layer's feature properties
    // This ensures that the script will not encounter any undefined values
    if (layer.feature && layer.feature.properties[attribute]) {
      // Script to update each circle's marker radius based on specified attribute value
      // and replace the popup/information panel content with new, associated content

      // Access the Feature properties
      var props = layer.feature.properties;

      // Calculate the radius for the proportional circleMarker using the specified attribute
      var radius = calcPropRadius(props[attribute]);
      // Use L.circle() "setRadius()" method to set circleMarker radius from proportional calculation above
      layer.setRadius(radius);

      // Pass Feature properties, updated attribute name, circleMarkers layer, and Feature circleMarker radius
      // to Popup constructor function to create interactivity content (tooltips via popupContent and panel information via panelContent)
      var popup = new Popup(props, attribute, layer, radius);

      // Add tooltips to circleMarkers
      popup.bindToLayer();

      // Add event listeners
      popup.listener();
    }
  });

  // Call updateLegend() function to update circle radiuses for max, mean, and min attribute values
  updateLegend(map, attribute);
}

function createPanel (map, attributes) {
  var PanelControl = L.Control.extend({
    options: {
      position: 'topright'
    },

    // OLD "onAdd" procedural code; stop propagation implementation does not work (from Lab Module 1-3 Lesson 2 Example 2.5)
    // See below commented block for OOP refactored code with functional stop propagation implementation
    // onAdd: function (map) {
    //   // var panelContainer = L.DomUtil.create('div', 'panel-container');
    //   panelContainer = L.DomUtil.create('div', 'panel-container');
    //
    //   $(panelContainer).on('dblclick mousedown ', function (e) {
    //     // https://leafletjs.com/reference-1.4.0.html#domevent-stoppropagation
    //     L.DomEvent.stopPropagation(e);
    //   });
    //
    //   return panelContainer;
    // }

    // "onAdd" code block above OOP refactored and stop propagation implementation fixed
    onAdd: function (map) {
      this.panelContainer = L.DomUtil.create('div', 'panel-container');

      // Updated/functional implementation of disabling click propagation
      // https://stackoverflow.com/a/37629102
      // http://jsfiddle.net/s8q35xhu/3/
      L.DomEvent.disableClickPropagation(this.panelContainer);
      // this.update();
      return this.panelContainer;
    }
  });

  map.addControl(new PanelControl());

  $('.panel-container').append('<div id="panel-header"></div>');
  $('#panel-header').html('<h1>Asthma in New York City</h1><p><i>An environmental justice issue?</i></p>');
  $('#panel-header').append('<small>New York City is home to some of the highest asthma hospitalization rates in the country. While the causes of asthma are not known, studies have shown a link between air pollution and asthma prevalence. With changes to land use zoning forcing certain demographic groups &ndash; namely racial minorites and the impoverished &ndash; closer to major sources of pollution, it begs the question:</small><p><b>Is there a link between asthma, race, and poverty in New York City?</b></p>');
  $('#panel-header').append('<small>Explore the data 2010-2016.<br>Aggregated for all ages by <a href="https://uhfnyc.org/">United Hospital Fund</a> boundaries.<br><i>Note: 2015 not shown due to asthma diagnosis code changes.</i></small>');
  $('.panel-container').append('<div id="panel-injected"></div>');
}

function createLegend (map, attributes) {
  var LegendControl = L.Control.extend({
    options: {
      position: 'bottomleft'
    },

    // Attempt at OOP refactoring caused issues here ... !!! LOOK MORE INTO !!
    // Procedural code maintained but stop propagation implementation fixed below
    onAdd: function (map) {
      // https://leafletjs.com/reference-1.4.0.html#domutil-create
      // Use Leaflet's DOM Utility with L.DomUtil.create() method to create div class='legend-container'
      // Do not use jQuery here; need to build out elements before Leaflet returns them to the DOM as part of control
      // instead of adding to DOM immediately (Lab Module 1-3 Lesson 2 Example 2.3)
      var legendContainer = L.DomUtil.create('div', 'legend-container');

      // Add temporal legend to legend-container
      $(legendContainer).append('<div id="temporal-legend"></div>');

      // Start attribute legend SVG string
      // "attribute-legend" height really should match "min" value in circle object
      // and "cy" value in jQuery .attr() method should be updated too (height - 1 (-1 for circleMarker radius))
      // but the values below look good
      var svg = '<svg id="attribute-legend" width="80px" height="54px">';

      // Create circle object containing circle names (max, mean, min) and text "y" coordinates as values for spacing on legend
      var circles = {
        max: 14,
        mean: 32,
        min: 50
      };

      // Loop to add each circle and text to SVG string
      for (var circle in circles) {
        // Instantiate SVG string
        // Assign id value based on current value of array
        svg += '<circle class="legend-circle" id="' + circle + '" fill="#6b6b7f" fill-opacity="0.6" stroke="#6b6b7f" cx="27"/>';

        // Add empty <text> element with unique id for each circle to the SVG string
        svg += '<text id="' + circle + '-text" x="59" y="' + circles[circle] + '"></text>';
      }

      // Close SVG string *outside* of loop so only closed once
      svg += '</svg>';

      // Add attribute legend to SVG container
      $(legendContainer).append(svg);

      // Original attempt at stop propagation implementation (from Lab Module 1-3 Lesson 2 Example 2.5); not functional, fixed below
      // $(legendContainer).on('mousedown dblclick', function (e) {
      //   // https://leafletjs.com/reference-1.4.0.html#domevent-stoppropagation
      //   L.DomEvent.stopPropagation(e);
      // });

      // Updated/functional implementation of disabling click propagation
      // https://stackoverflow.com/a/37629102
      // http://jsfiddle.net/s8q35xhu/3/
      L.DomEvent.disableClickPropagation(legendContainer);

      return legendContainer;
    }
  });

  map.addControl(new LegendControl());

  updateLegend(map, attributes[0]);
}

function updateLegend (map, attribute) {
  // Create legend content HTML string
  var year = attribute.split('_')[3];
  var legendContent = '<p><b>Asthma hospitalization rate</b><br>per 10k residents</p><h1>' + year + '</h1>';

  // Replace legend content
  $('#temporal-legend').html(legendContent);

  // Get max, mean, and min values for a given attribute as an object and assign to circleValues variable
  var circleValues = getCircleValues(map, attribute);

  for (var key in circleValues) {
    // Get radius
    var radius = calcPropRadius(circleValues[key]);

    // Assign SVG "cy" and "r" values
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
    // "cy: 53 - radius" because max circleMarker radius is currently 26 * 2 = 52 diameter + 1 + 1 (for border on each side of circle) = 54
    // 54 - 1 (for radius at base of circle) = 53
    $('#' + key).attr({
      cy: 53 - radius,
      r: radius
    });

    // Add legend text
    $('#' + key + '-text').text(Math.round(circleValues[key]));
  }
}

// Calculate the max, mean, and min values for a given attribute
function getCircleValues (map, attribute) {
  // Start with min at highest possible number and max at lowest possible number
  var min = Infinity;
  var max = -Infinity;

  // Iterate over every layer on the map (including each circle marker) using eachLayer() method
  // See Lab Module 1-3 Lesson 3 between Example 3.8 and 3.9
  map.eachLayer(function (layer) {
    // Get the attribute value
    // Test whether layer has feature attached to it based on GeoJSON data (i.e., whether a circleMarker)
    if (layer.feature) {
      // If it does, feature's attribute value assigned to attributeValue variable
      var attributeValue = Number(layer.feature.properties[attribute]);

      // Test attributeValue against min
      if (attributeValue < min) {
        min = attributeValue;
      }

      // Test attributeValue against max
      if (attributeValue > max) {
        max = attributeValue;
      }
    }
  });

  // Set mean
  var mean = (max + min) / 2;

  // Return max, mean, and min values as object
  return {
    max: max,
    mean: mean,
    min: min
  };
}

$(document).ready(createMap);
