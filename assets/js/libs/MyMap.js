;(function($) {

	
	var MyMap = function(obj, options) {

		

		var $t = $(obj);

		var t = {
			callback: {
				newMarker: function(marker, lat, lng) {},	
			},
			db: new localStorageDB("MapIndex", localStorage),
			bounds: new google.maps.LatLngBounds(),
			editIndex: false,
			geocoder: new google.maps.Geocoder(),
			map: false,
			mapOptions: {
				zoom: 15,
				
				center: new google.maps.LatLng(39.984175, -86.119735), 
				
				mapTypeId: google.maps.MapTypeId.TERRAIN, 
				scrollwheel: true
			},
			markers: [],
            circle: null,
			ui: {
				map: $t
			}
		}

		if(!options) {
			var options = {};
		}

		t = $.extend(true, t, options);

		
		t.init = function(options) {

			if(options) {
				t.mapOptions = $.extend(true, t.mapOptions, options);	
			}

			t.map = new google.maps.Map(t.ui.map.get(0), t.mapOptions);



			if(!t.db.tableExists('markers')) {			
			    t.db.createTable("markers", ["name", "address", "response", "street", "city", "state", "zipcode", "lat", "lng"]);
			    t.db.commit();
			}

			if(!t.db.tableExists('settings')){
				t.db.createTable("settings", ['icon', 'size', 'map_type']);
				t.db.commit();
				t.db.insert("settings", {icon: "false", size: "false", map_type: "ROADMAP"});
				t.db.commit();
			}

			
			t.db.query('markers', function(row) {
				t.newMarker(row.lat, row.lng);
			});

			t.startSettings();

			return t.map;
		}

		t.submitSettings = function(settings) {
				if(settings.icon=="") settings.icon="false";
				if(settings.size=="") settings.size="false";
				t.db.insertOrUpdate('settings', {ID: 0},{
					icon: settings.icon,
					size: settings.size,
					map_type: settings.map_type
				});
		}



		t.startSettings = function()
		{
			var row = t.db.query('settings', {ID: 0});
			row = row[0];

			
			if(row.map_type=="ROADMAP")
				t.map.setMapTypeId(google.maps.MapTypeId.ROADMAP);

			
			if(row.map_type=="TERRAIN")
				t.map.setMapTypeId(google.maps.MapTypeId.TERRAIN);

			
			if(row.map_type=="SATELLITE")
				t.map.setMapTypeId(google.maps.MapTypeId.SATELLITE);

			
			if(row.map_type=="HYBRID")
				t.map.setMapTypeId(google.maps.MapTypeId.HYBRID);


		}

		
		t.home = function() {
			google.maps.event.trigger(t.map, 'resize');
			t.map.setZoom(t.mapOptions.zoom);
			t.map.fitBounds(t.bounds);

			$('a[href="#home"]').click();	
		}

		
        t.delete_location = function(id) {
            t.db.deleteRows("markers", {ID: id});
            t.markers[id-1].setVisible(false);
            t.markers[id-1] = false;
            t.db.commit();
        }
        
		t.hideAllMarkers = function() {
            var i = 0;
            for(i; i < t.markers.length; i++){
                t.markers[i].setVisible(false);   
            }
        }

        t.showAllMarkers = function() {
            var i = 0;
            for(i; i < t.markers.length; i++){
                t.markers[i].setVisible(true);
            }
        }

		
		t.newMarker = function(lat, lng) {
			var latLng = new google.maps.LatLng(lat, lng);

			marker = new google.maps.Marker({
				map: t.map,
				position: latLng 
			});

			t.callback.newMarker(marker, lat, lng, t.markers.length);

			t.markers.push(marker);
			t.bounds.extend(latLng);
			t.map.fitBounds(t.bounds);

			return marker;
		}

		
        t.clearSearch = function() {
            t.showAllMarkers();
            t.circle.setVisible(false);
            t.circle = null; 
        }

		
        t.search = function(address, distance) {
            var loc = t.geocode(address, function(response) {
                if(response.success){
                    var lat = response.results[0].geometry.location.lat();
                    var lng = response.results[0].geometry.location.lng();
                    var circle_settings = {
                        fillColor: "red",
                        fillOpacity: .4,
                        strokeColor: "blue",
                        center: new google.maps.LatLng(lat, lng),
                        radius: distance * 1500,
                        map: t.map
                    };
					
                    var circle = new google.maps.Circle(circle_settings); 
                    if(t.circle != null){
                        t.circle.setVisible(false);
                    }
                    t.circle = circle;
                    var markers = [];
                    t.db.query('markers', function(m){
						
                        var diameter = ((Math.acos(Math.sin(lat * Math.PI / 180) * Math.sin(m.lat * Math.PI / 180) + Math.cos(lat * Math.PI / 180) * Math.cos(m.lat * Math.PI / 180) * Math.cos((lng - m.lng) * Math.PI / 180)) * 180 / Math.PI) * 60 * 1.1515)
                        if(diameter < distance){
                            markers.push(m);
                        }
                    });
					
                    t.hideAllMarkers();
                    var i = 0;
                    for(i; i < markers.length; i++){
                        var h = 0;
                        for(h; h < t.markers.length; h++){
                            var loc = t.markers[h].getPosition();
                            if(markers[i].lat == loc.lat() && markers[i].lng == loc.lng()){
                                t.markers[h].setVisible(true);
                            }
                        }
                    }

                    t.map.setCenter(new google.maps.LatLng(lat, lng));
                    t.map.fitBounds(t.map.getBounds().union(circle.getBounds()));
                } 
            });   
        }
		
		t.updateMarker = function(marker, lat, lng) {
			marker.setPosition(new google.maps.LatLng(lat, lng));
		}
		
		t.editMarker = function(location, callback) {

			t.geocode(location.address, function(response) {
				if(response.success) {

					var lat = response.results[0].geometry.location.lat();
					var lng = response.results[0].geometry.location.lng();
					var hasLatLng = t.hasLatLng(lat, lng);
											
					t.updateMarker(t.markers[t.editIndex], lat, lng);

					t.db.update("markers", {ID: t.editIndex+1}, function() {

						var row = {
							name: location.name,
							address: location.address,
							street: location.street,
							city: location.city,
							state: location.state,
							zipcode: location.zipcode,
							response: response,
							lat: lat,
							lng: lng
						}

						return row;
					});

						t.db.commit();

						if(typeof callback == "function") {
							callback(response, location);
						}
					
				}
				else {
					alert('\''+$.trim(location.address)+'\' is an invalid location');
				}
			});
		}
		
		t.addMarker = function(location, save, callback) {

			if(typeof save == "undefined") {
				var save = true;
			}

			if(typeof save == "function") {
				callback = save;
				save = true;
			}

			t.geocode(location.address, function(response) {
				if(response.success) {

					var lat = response.results[0].geometry.location.lat();
					var lng = response.results[0].geometry.location.lng();
					var hasLatLng = t.hasLatLng(lat, lng);
					var marker = false;

					if(hasLatLng) {
						alert('\''+$.trim(location.address)+'\' is already a location on the map');	
					}
					else {						
						t.newMarker(lat, lng);

						if(typeof callback == "function") {
							callback(response, location, save);
						}
					}

					if(save && !hasLatLng) {
						t.db.insert("markers", {
							name: location.name,
							address: location.address,
							street: location.street,
							city: location.city,
							state: location.state,
							zipcode: location.zipcode,
							response: response,
							lat: lat,
							lng: lng
						});

						t.db.commit();
					}
				}
				else {
					alert('\''+$.trim(location.address)+'\' is an invalid location');
				}
			});
		}

		t.hasLatLng = function(lat, lng) {
			var _return = false;

			t.db.query('markers', function(row) {
				if(row.lat == lat && row.lng == lng) {
					_return = true;	
				}
			});

			return _return;
		}
		
		t.geocode = function(location, callback) {
			if(typeof callback != "function") {
				callback = function() {};
			}

			t.geocoder.geocode({'address': location}, function(results, status) {

				var response = {
					success: status == google.maps.GeocoderStatus.OK ? true : false,
					status: status,
					results: results
				}

				callback(response);
			});
		}

		t.init();

		return t;
	}

	$.fn.MyMap = function(options) {
		return new MyMap($(this), options);
	}	

})(jQuery);