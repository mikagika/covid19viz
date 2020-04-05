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
// note

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
    var selection = "Country="+srchCountry+", State="+srchState+", County="+srchCounty
    console.log("Summarizing for "+selection);
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

    console.log("Done summarization");

    showData(days, locales, selection, "confirmed");

};

/**
 * Display the data selected in both tabular and graphical form 
 */
var showData = function(days, locales, selection, dimension) {
    console.log("showing data for dimension ", dimension);
    var dimDelta = dimension+"Delta";
    var boxWidth = 1200;
    var boxHeight = 800;
    var margin= { t: 100, r: 200, b: 50, l: 75, rAxis: 0};
    var width   = boxWidth - margin.l - margin.r,
    height  = boxHeight - margin.t - margin.b,
    colWidth = 1; // this will be changed later


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

    var svg = d3.select('body').select("#chartDays").selectAll("*").remove(); // be sure to get rid of all children (unhook them too?)
    var svg = d3.select('body').select("#chartDays").html("");

    $("#chartDays").width(boxWidth);
    $("#chartDays").height(boxHeight);


    var x, xAxis, y, yAxis, y_2, y2Axis, xExtent, yExtent, yExtent2;  // core axis definitions that will get reused many times
    var timeParser = d3.timeParse("%Y%m%d");
    var timeFormatter = d3.timeFormat("%Y-%m-%d");
    xExtent = d3.extent(days, d => timeParser(d.date));
    x = d3.scaleTime().domain(xExtent).range([0, width]);
    xAxis   = d3.axisBottom(x).tickSizeOuter(8).tickFormat(timeFormatter).ticks(10);
    yExtent = d3.extent(days, d => d[dimension]);
    y       = d3.scaleLinear().domain(yExtent).range([height, 0]);
    yAxis   = d3.axisLeft(y).tickSizeInner(-width).ticks(10);
    var ticks = y.ticks(); // gets the array of ticks that d3 wants to use
    if (ticks[ticks.length - 1] < yExtent[1] ) {  // if the last tick isn't at the max of the chart
        var stride = ticks[1] - ticks[0];                           // determine increment d3 is using
        y.domain([yExtent[0],ticks[ticks.length - 1] + stride]);  // reset the domain
    }
    yExtent2 = d3.extent(days, d => d[dimDelta]);
    y_2     = d3.scaleLinear().domain(yExtent2).range([height, 0]);
    y2Axis  = d3.axisRight(y_2).tickSizeInner(0).ticks(10).tickPadding(width+10);
    var ticks = y_2.ticks(); // gets the array of ticks that d3 wants to use
    if (ticks[ticks.length - 1] < yExtent2[1] ) {  // if the last tick isn't at the max of the chart
        var stride = ticks[1] - ticks[0];                           // determine increment d3 is using
        y_2.domain([yExtent2[0],ticks[ticks.length - 1] + stride]);  // reset the domain
    }

    svg = svg.append('svg')
        .attr("viewBox","0 0 "+boxWidth+" "+boxHeight)
        .attr("preserveAspectRatio","none")         // decided better to err on side of seeing everything
        .attr("style","height:100%;width:100%");

    svg.append("rect")
        .attr("x",0)
        .attr("y",0)
        .attr("width",boxWidth)
        .attr("height",boxHeight)
        .attr("fill","none")
        .attr("stroke-width","2")
        .attr("stroke","#a5a5a5")
    ;

    var titleg = svg.append("g")
        .attr("transform","translate("+margin.l+",0)");
    titleg.append("text")
        .attr("class","title")
        .attr("width",width)
        .attr("x",width/2)
        .attr("y",33)
        .text("Daily COVID-19 Data");
    titleg.append("text")
        .attr("class","subtitle")
        .attr("width",width)
        .attr("x",width/2)
        .attr("y",60)
        .text(selection);
    titleg.append("text")
        .attr("class","datatitle")
        .attr("width",width)
        .attr("x",width/2)
        .attr("y",90)
        .text(dimension)
        ;

    svg.append('g')  // y axis label
        .append('text')
        .attr('class','yLabel')
        .attr('transform','rotate(-90)')
        .attr('x',0-(height/2)-margin.t-margin.b)
        .attr('y',16)
        .text("Total");

    svg.append('g')  // y2 axis label
        .append('text')
        .attr('class','yLabel')
        .attr('transform','rotate(-90)')
        .attr('x',0-(height/2)-margin.t-margin.b)
        .attr('y',margin.l+width+60)
        .text("Incremental");



    var vis = svg
      .append('g')
      .attr("class","graph")
      .attr('transform', 'translate(' + margin.l + ',' + margin.t + ')');

    vis.append('g')
        .attr('class', 'x axis')
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        ;

    vis.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .selectAll("text")
        .append("title").text("Total")
        ;

    vis.append('g')
        .attr('class', 'y axis2')
        .call(y2Axis)
        .selectAll("text")
        .append("title").text("Incremental")
        ;

    console.log("Done visualization");
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
