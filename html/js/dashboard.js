/* globals Chart:false, feather:false */

we3 = (function () {
  'use strict'

var popData = {};
var keys = {};
var covid = {
	obs: [],
    country: {idx:{},list:[]},
    date: {idx:{},list:[]}
};
var minDate = "20200322";  // oldest complete data we have, ignore anything older

var parsePopData = function(csv) {
	console.log("Parsing population data");
    var lines = csv; // assume an array?
    if (csv.indexOf("\n") >= 0) {
        lines = csv.split("\n");
    }
    console.log("Reading "+lines.length+" existing data lines");
    for (var k=1;k<lines.length;k++) {
        var data = lines[k].split(",");
        if (data && data.length >= 5) {
			var obs = {
				fips: data[0],
				state: data[1],
				county: data[2].split(" ")[0],
				pop2010: data[3],
				popEst: data[4]
			}
			popData[obs.fips] = obs;
		}
	}
	console.log("Populated population data, fetching daily report file");
    $.ajax({
        'async': true,
        'global': false,
        'url': 'data/covid19_daily_reports.csv',
        'dataType': "text",
        'success': function (data) {
            parseCovidData(data);
        },
        'error': function(resp) {
            console.log("Error retrieving popEstimate.csv, status: "+resp.status+" "+resp.statusText);
            console.log(resp.responseText);
        }
    });
};

var parseCovidData = function(csv) {
	console.log("Fetched daily report, parsing...");
    var lines = csv; // assume an array?
    if (csv.indexOf("\n") >= 0) {
        lines = csv.split("\n");
    }
    console.log("Reading "+lines.length+" existing data lines");
    for (var k=1;k<lines.length;k++) {
        var data = lines[k].split(",");
        if (data && data.length >= 9) {
            var tobs = {
                fips: data[0],
                country: data[1], 
                state: data[2],
                county: data[3],
                date: data[4].substr(0,4)+data[4].substr(5,2)+data[4].substr(8,2),
                confirmed: data[5],
                died: data[6],
                recovered: data[7],
                active: data[8]
            }
            if (tobs.date >= minDate) {  // ignore older data from locales that haven't been updated in a while
                var idx = covid.obs.length;
                covid.obs.push(tobs);
                updateIndexes(tobs);
                keys[tobs.country+tobs.state+tobs.county+tobs.date] = true;    
            }
        }
	}
    console.log("Daily report data parsed");
    populateSelects();
	summarize("all","all","all");
};

var populateSelects = function() {

};

/**
 * Updates the covid object indexes based on a current observation
 * @param {object} tobs this observation
 */
var updateIndexes = function(tobs) {
    if (typeof covid.date.idx[tobs.date] == "undefined") {
        covid.date.idx[tobs.date] = covid.date.list.length;
        covid.date.list.push(tobs.date);
    }
    if (typeof covid.country.idx[tobs.country] == "undefined") {
        covid.country.idx[tobs.country] = covid.country.list.length;
        covid.country.list.push({name:tobs.country, state:{idx:{},list:[]}});
	}
	if (tobs.state) {
		var tcountry = covid.country.list[covid.country.idx[tobs.country]]; // get this country
		if (typeof tcountry.state.idx[tobs.state] == "undefined") {
			tcountry.state.idx[tobs.state] = tcountry.state.list.length;
			tcountry.state.list.push({name:tobs.state, county:{idx:{},list:[]}});
		}
		if (tobs.state) {
			var tstate = tcountry.state.list[tcountry.state.idx[tobs.state]]; // get this state 
			if (typeof tstate.county.idx[tobs.county] == "undefined") {
				tstate.county.idx[tobs.county] = tstate.county.list.length;
				tstate.county.list.push({name:tobs.county});
			}
		}
	}
    return;
};

/**
 * Summarize and display the data 
 * @param {*} srchCountry - The country to search for or all for all countries
 * @param {*} srchState - The state to search for or all for all states
 * @param {*} srchCounty - The county to search for or all for all counties
 */
var summarize = function(srchCountry, srchState, srchCounty) {
    console.log("Summarizing for country="+srchCountry+", state="+srchState+", county="+srchCounty);
    var days = [];
    var dayIdx = {};
    var locales = [];
    var localeIdx = {};
    var matches = [];
    var maxDate = '';

    // loop through all the data, find matching observations, total to days and locale-days
    for (var k=0;k<covid.obs.length;k++) {
        var tobs = covid.obs[k];
        var locale = '';
        if (srchCountry === "all" || srchCountry === tobs.country) {
            locale += tobs.country;
            if (srchState === "all" || srchState === tobs.state) {
                locale += srchCountry !== "all" ? ", " + tobs.state : "";  // if we searched for specific country, include state in locale
                if (srchCounty === "all" || srchCounty === tobs.county) {
                    locale += srchState !== "all" ? ", " + tobs.county : "";  // if we searched for specific state, include county in locale
                    //tobs.locale = locale; // add in the current locale level
                    //matches.push(tobs); 
                    if (typeof dayIdx[tobs.date] === "undefined") {
                        dayIdx[tobs.date] = days.length;
                        days.push({
                            date:tobs.date,
                            confirmed: tobs.confirmed * 1,  // really, I want these numeric!
                            died: tobs.died * 1,
                            recovered: tobs.recovered * 1,
                            active: tobs.active * 1
                        });
                        //maxDate = tobs.date > maxDate ? tobs.date : maxDate; 
                    }
                    else {  // increment day's totals 
                        var d = dayIdx[tobs.date];
                        days[d].confirmed += tobs.confirmed * 1;
                        days[d].died += tobs.died * 1;
                        days[d].recovered += tobs.recovered * 1;
                        days[d].active += tobs.active * 1;
                    }

                    // now let's populate the locale data 
                    if (typeof localeIdx[locale] === "undefined") {
                        localeIdx[locale] = locales.length;
                        locales.push({
                            locale: locale,
                            days: [],
                            dayIdx: {}
                        });
                    }
                    var tloc = locales[localeIdx[locale]];
                    if (typeof tloc.dayIdx[tobs.date] === "undefined") {
                        tloc.dayIdx[tobs.date] = tloc.days.length;
                        tloc.days.push({
                            date:tobs.date,
                            confirmed: tobs.confirmed * 1,  // really, I want these numeric!
                            died: tobs.died * 1,
                            recovered: tobs.recovered * 1,
                            active: tobs.active * 1
                        });
                    }
                    else { // increment the day's totals 
                        var d = tloc.dayIdx[tobs.date];
                        tloc.days[d].confirmed += tobs.confirmed * 1;
                        tloc.days[d].died += tobs.died * 1;
                        tloc.days[d].recovered += tobs.recovered * 1;
                        tloc.days[d].active += tobs.active * 1;
                    }
                }
            }
        }
    }

    // It is possible that the date might not be entirely properly sorted, so fix that 
    days.sort(function (a,b) {
        if (a.date === b.date) {
            return 0;
        }
        else {
            return a.date < b.date ? -1 : 1;
        }
    });
    // calculate daily changes
    for (var d=1;d<days.length;d++) {
        var d0 = d - 1;
        days[d].confirmedDelta = days[d].confirmed - days[d0].confirmed;
        days[d].diedDelta = days[d].died - days[d0].died;
        days[d].recoveredDelta = days[d].recovered - days[d0].recovered;
        days[d].activeDelta = days[d].active - days[d0].active;
    }

    // iterate through the locales and do the same by locale
    for (var k=0;k<locales.length;k++) {
        var tloc = locales[k];
        // It is possible that the date might not be entirely properly sorted, so fix that 
        tloc.days.sort(function (a,b) {
            if (a.date === b.date) {
                return 0;
            }
            else {
                return a.date < b.date ? -1 : 1;
            }
        });
        // calculate daily changes
        for (var d=1;d<tloc.days.length;d++) {
            var d0 = d - 1;
            tloc.days[d].confirmedDelta = tloc.days[d].confirmed - tloc.days[d0].confirmed;
            tloc.days[d].diedDelta = tloc.days[d].died - tloc.days[d0].died;
            tloc.days[d].recoveredDelta = tloc.days[d].recovered - tloc.days[d0].recovered;
            tloc.days[d].activeDelta = tloc.days[d].active - tloc.days[d0].active;
        }
    }

    var ohtml = [];
    for (var k=days.length - 1;k>=0;k--) {
        var tobs = days[k];
        ohtml.push("<tr>");
        ohtml.push("<td>"+tobs.date+"</td>");
        ohtml.push("<td>"+tobs.confirmed+"</td>");
        ohtml.push("<td>"+tobs.confirmedDelta+"</td>");
        ohtml.push("<td>"+tobs.died+"</td>");
        ohtml.push("<td>"+tobs.diedDelta+"</td>");
        ohtml.push("<td>"+tobs.recovered+"</td>");
        ohtml.push("<td>"+tobs.recoveredDelta+"</td>");
        ohtml.push("<td>"+tobs.active+"</td>");
        ohtml.push("<td>"+tobs.activeDelta+"</td>");
        ohtml.push("</tr>");
    }
    $("#daysTBody").html(ohtml.join(""));

    ohtml = [];
    for (var k=0;k<locales.length;k++) {
        var tobs = locales[k].days[locales[k].days.length - 1];
        ohtml.push("<tr>");
        ohtml.push("<td>"+locales[k].locale+"</td>");
        ohtml.push("<td>"+tobs.confirmed+"</td>");
        ohtml.push("<td>"+tobs.confirmedDelta+"</td>");
        ohtml.push("<td>"+tobs.died+"</td>");
        ohtml.push("<td>"+tobs.diedDelta+"</td>");
        ohtml.push("<td>"+tobs.recovered+"</td>");
        ohtml.push("<td>"+tobs.recoveredDelta+"</td>");
        ohtml.push("<td>"+tobs.active+"</td>");
        ohtml.push("<td>"+tobs.activeDelta+"</td>");
        ohtml.push("</tr>");
    }
    $("#localesTBody").html(ohtml.join(""));

    console.log("Done summarization");

};

return {
	initialize: function() {
		$.ajaxSetup ({
			// Disable caching of AJAX responses
			cache: false
		});
		console.log("Fetching population data");
		$.ajax({
			'async': true,
			'global': false,
			'url': 'data/popEstimate.csv',
			'dataType': "text",
			'success': function (data) {
				parsePopData(data);
			},
			'error': function(resp) {
				console.log("Error retrieving popEstimate.csv, status: "+resp.status+" "+resp.statusText);
				console.log(resp.responseText);
			}
		});
	}

} // return public functions

	
})();  // end of we3 function
