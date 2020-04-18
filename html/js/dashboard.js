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
var unlocked = true; 

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
            if (obs.fips > 0) {
                popData[obs.fips] = obs;
            }
            else {
                popData[data[1]+"_"+data[2]] = obs;
            }
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
            if (data[5] == 0 &&
                (data[3]==="Bronx" || data[3]==="Kings" || data[3]==="Queens" || data[3]==="Richmond" || data[3]==="Seneca" || data[3]==="Yates" )) {
                continue;  // skip these to avoid adding in their populations
            }
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
  populateSelects("all");
	document.getElementById("selectCountry").addEventListener("change", summarizeFromDocCountry);
	document.getElementById("selectState").addEventListener("change", summarizeFromDocState);
	document.getElementById("selectCounty").addEventListener("change", summarizeFromDocCounty);
	summarize("All","All","All");
};

/**
 * Populates the select boxes
 */
var populateSelects = function(level) {
	var selectCountry = document.getElementById("selectCountry");
	var selectState = document.getElementById("selectState");
	var selectCounty = document.getElementById("selectCounty");
	
	console.log(level);
	if(level == "all") {
		covid.country.list.forEach(country => {
			var newOption = document.createElement("option");
			newOption.innerText = country.name;
			selectCountry.appendChild(newOption);
		});
	} else if(level == "country") {
		// Remove any pre-existing state & county options
		var allOption = document.createElement("option");
		allOption.innerText = "All";
		var allOption2 = document.createElement("option");
		allOption2.innerText = "All";
		
		selectState.innerHTML = '';
		selectState.appendChild(allOption);
		
		selectCounty.innerHTML = '';
		selectCounty.appendChild(allOption2);
		
		if(covid.country.idx[selectCountry.selectedOptions[0].textContent] >= 0) {
			covid.country.list[covid.country.idx[selectCountry.selectedOptions[0].textContent]].state.list.forEach(state => {
				var newOption = document.createElement("option");
				newOption.innerText = state.name;
				selectState.appendChild(newOption);
			});
		}
	} else if(level == "state") {
		// Remove any preexisting county options
		var allOption = document.createElement("option");
		allOption.innerText = "All";
		
		selectCounty.innerHTML = '';
		selectCounty.appendChild(allOption);
		
		var states = covid.country.list[covid.country.idx[selectCountry.selectedOptions[0].textContent]].state
		if(states.idx[selectState.selectedOptions[0].textContent] >= 0) {
			states.list[states.idx[selectState.selectedOptions[0].textContent]].county.list.forEach(county => {
				var newOption = document.createElement("option");
				newOption.innerText = county.name;
				selectCounty.appendChild(newOption);
			});
		}
	}
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
 * Wrapper to get around passing value in addEventListener for selectCountry
 */
var summarizeFromDocCountry = function() {
	summarizeFromDoc("country");
}

/**
 * Wrapper to get around passing value in addEventListener for selectState
 */
var summarizeFromDocState = function() {
	summarizeFromDoc("state");
}

/**
 * Wrapper to get around passing value in addEventListener for selectCounty
 */
var summarizeFromDocCounty = function() {
	summarizeFromDoc("county");
}

/**
 * Wrapper to call summarize more easily from the doc
 */
var summarizeFromDoc = function(level) {
  populateSelects(level);
  
  var selectedCountry = document.getElementById("selectCountry").selectedOptions[0].label;
	var selectedState = document.getElementById("selectState").selectedOptions[0].label;
	var selectedCounty = document.getElementById("selectCounty").selectedOptions[0].label;
	console.log(selectedCountry, selectedState, selectedCounty);
  summarize(selectedCountry, selectedState, selectedCounty);
}

/**
 * Summarize and display the data 
 * @param {*} srchCountry - The country to search for or all for all countries
 * @param {*} srchState - The state to search for or all for all states
 * @param {*} srchCounty - The county to search for or all for all counties
 */
var summarize = function(srchCountry, srchState, srchCounty) {
    var selection = "Country="+srchCountry+", State="+srchState+", County="+srchCounty
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
        if (srchCountry === "All" || srchCountry === tobs.country) {
            locale += tobs.country;
            if (srchState === "All" || srchState === tobs.state) {
                locale += srchCountry !== "All" ? ", " + tobs.state : "";  // if we searched for specific country, include state in locale
                if (srchCounty === "All" || srchCounty === tobs.county) {
                    locale += srchState !== "All" ? ", " + tobs.county : "";  // if we searched for specific state, include county in locale
                    //tobs.locale = locale; // add in the current locale level
                    //matches.push(tobs); 
                    var pop = 0;
                    if (!isNaN(tobs.fips) && popData[tobs.fips*1]) {
                        pop = popData[tobs.fips*1].popEst * 1;
                    }
                    else {
                        pop = popData[tobs.country+"_"+tobs.state];
                        if (pop) {
                            pop = pop.popEst * 1;
                        }
                        if (isNaN(pop)) {  // in case we mess it up
                            pop = 0;
                        }
                    }
                    if (typeof dayIdx[tobs.date] === "undefined") {
                        dayIdx[tobs.date] = days.length;
                        days.push({
                            date:tobs.date,
                            confirmed: tobs.confirmed * 1,  // really, I want these numeric!
                            died: tobs.died * 1,
                            recovered: tobs.recovered * 1,
                            active: tobs.active * 1,
                            population: pop
                        });
                        //maxDate = tobs.date > maxDate ? tobs.date : maxDate; 
                    }
                    else {  // increment day's totals 
                        var d = dayIdx[tobs.date];
                        days[d].confirmed += tobs.confirmed * 1;
                        days[d].died += tobs.died * 1;
                        days[d].recovered += tobs.recovered * 1;
                        days[d].active += tobs.active * 1;
                        days[d].population += pop;
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
                            active: tobs.active * 1,
                            population: pop
                        });
                    }
                    else { // increment the day's totals 
                        var d = tloc.dayIdx[tobs.date];
                        tloc.days[d].confirmed += tobs.confirmed * 1;
                        tloc.days[d].died += tobs.died * 1;
                        tloc.days[d].recovered += tobs.recovered * 1;
                        tloc.days[d].active += tobs.active * 1;
                        tloc.days[d].population += pop;
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
        days[d].conf100k = days[d].population > 0 ? days[d].confirmed / (days[d].population / 100000) : null;
        days[d].new100k = days[d].population > 0 ? days[d].confirmedDelta / (days[d].population / 100000) : null;
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
            tloc.days[d].conf100k = tloc.days[d].population > 0 ? tloc.days[d].confirmed / (tloc.days[d].population / 100000) : null;
            tloc.days[d].new100k = tloc.days[d].population > 0 ? tloc.days[d].confirmedDelta / (tloc.days[d].population / 100000) : null;
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
    var fmt = d3.format(",.0f");
    var fmtPct = d3.format(",.1f");
    var dimDelta = dimension+"Delta";
    var boxWidth = 720;
    var boxHeight = 430;
    var margin= { t: 100, r: 100, b: 50, l: 100, rAxis: 0};
    var width   = boxWidth - margin.l - margin.r;
    var height  = boxHeight - margin.t - margin.b;
    var colWidth = 1; // this will be changed later

    //$("#chartDays2").html($("#chartDays").html());
    //$("#chartLocales2").html($("#chartLocales").html());
    $(".chartLines").height(boxHeight+5);
    if (unlocked) {  // if unlocked we need to shove the charts around, otherwise we just replace the first one
        var chartsDays = $("#lineDays div");
        var chartsLocales = $("#lineLocales div");
        if (chartsDays.length === 2) {
            $(chartsDays[1]).remove();
        }
        if (chartsDays.length >=1 ) {
            $(chartsDays[0]).animate({left: (boxWidth + 5)},500);
        }
        $("#lineDays").prepend("<div class='chart'></div>");
    
        if (chartsLocales.length === 2) {
            $(chartsLocales[1]).remove();
        }
        if (chartsLocales.length >= 1) {
            $(chartsLocales[0]).animate({left: (boxWidth + 5)},500);
        }
        $("#lineLocales").prepend("<div class='chart'></div>");
    }

    var chartDay = $("#lineDays div")[0];
    $(chartDay).width(boxWidth);
    $(chartDay).height(boxHeight);
    var chartLocale = $("#lineLocales div")[0];
    $(chartLocale).width(boxWidth);
    $(chartLocale).height(boxHeight);

    var ohtml = [];
    for (var k=days.length - 1;k>=0;k--) {
        var tobs = days[k];
        ohtml.push("<tr>");
        ohtml.push("<td>"+tobs.date.substr(0,4)+"-"+tobs.date.substr(4,2)+"-"+tobs.date.substr(6,2)+"</td>");
        ohtml.push("<td>"+fmt(tobs.confirmed)+"</td>");
        ohtml.push("<td>"+fmt(tobs.confirmedDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.died)+"</td>");
        ohtml.push("<td>"+fmt(tobs.diedDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.recovered)+"</td>");
        ohtml.push("<td>"+fmt(tobs.recoveredDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.active)+"</td>");
        ohtml.push("<td>"+fmt(tobs.activeDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.population)+"</td>");
        ohtml.push("<td>"+fmt(tobs.conf100k)+"</td>");
        ohtml.push("<td>"+fmtPct(tobs.new100k)+"</td>");
        ohtml.push("</tr>");
    }
    $("#daysTBody").html(ohtml.join(""));

    var sortedLocales = [];
    ohtml = [];
    for (var k=0;k<locales.length;k++) {
        var tobs = locales[k].days[locales[k].days.length - 1];
        tobs.locale = locales[k].locale;
        sortedLocales.push(tobs);
        ohtml.push("<tr>");
        ohtml.push("<td>"+locales[k].locale+"</td>");
        ohtml.push("<td>"+fmt(tobs.confirmed)+"</td>");
        ohtml.push("<td>"+fmt(tobs.confirmedDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.died)+"</td>");
        ohtml.push("<td>"+fmt(tobs.diedDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.recovered)+"</td>");
        ohtml.push("<td>"+fmt(tobs.recoveredDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.active)+"</td>");
        ohtml.push("<td>"+fmt(tobs.activeDelta)+"</td>");
        ohtml.push("<td>"+fmt(tobs.population)+"</td>");
        ohtml.push("<td>"+fmt(tobs.conf100k)+"</td>");
        ohtml.push("<td>"+fmtPct(tobs.new100k)+"</td>");
        ohtml.push("</tr>");
    }
    $("#localesTBody").html(ohtml.join(""));

    sortedLocales.sort(function(a,b) {
        return b[dimension]*1 - a[dimension]*1;
    });

    // Make the graphs

    var svg = d3.select('body').select("#lineDays div").selectAll("*").remove(); // be sure to get rid of all children (unhook them too?)
    svg = d3.select('body').select("#lineDays div").html("");

    var x, xAxis, y, yAxis, y_2, y2Axis, xExtent, yExtent, yExtent2;  // core axis definitions that will get reused 
    var timeParser = d3.timeParse("%Y%m%d");
    var timeFormatter = d3.timeFormat("%Y-%m-%d");
    xExtent = d3.extent(days, d => timeParser(d.date));
    xExtent[1] = xExtent[1].getTime()+(86400*1000); // because days are one day wide, so need to fit an extra day on x axis
    x = d3.scaleTime().domain(xExtent).range([0, width]);
    xAxis   = d3.axisBottom(x).tickSizeOuter(8).tickFormat(timeFormatter).ticks(6);
    var colWidth = Math.round((x(timeParser("20200323")) - x(timeParser("20200322")))*.97);

    yExtent = d3.extent(days, d => d[dimension]);
    yExtent[0] = 0; // always make it zero based
    y       = d3.scaleLinear().domain(yExtent).range([height, 0]);
    yAxis   = d3.axisLeft(y).tickSizeInner(-width).ticks(10);
    var ticks = y.ticks(); // gets the array of ticks that d3 wants to use
    if (ticks[ticks.length - 1] < yExtent[1] ) {  // if the last tick isn't at the max of the chart
        var stride = ticks[1] - ticks[0];                           // determine increment d3 is using
        y.domain([yExtent[0],ticks[ticks.length - 1] + stride]);  // reset the domain
    }

    yExtent2 = d3.extent(days, d => d[dimDelta]);
    yExtent2[0] = 0; // always make it zero based
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


    // create the space and labeling for the visualization
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

    // Add the bars
    var groups = vis.selectAll("rect")
        .data(days)
        .enter().append("g");
    groups.append("rect")
            .attr("class","dimObs")
            .attr("x",function(d) {
                return x(timeParser(d.date));
            })
            .attr("y",function(d) {
                return y(d[dimension]);
            })
            .attr("height", function(d) {
                return y(0) - y(d[dimension]);
            })
            .attr("width", colWidth);
    groups.append("rect")  // add the incremental value
            .attr("class","dimObsDelta")
            .attr("x",function(d) {
                return x(timeParser(d.date));
            })
            .attr("y",function(d) {
                return d[dimDelta] ? y(d[dimDelta]) : 0;
            })
            .attr("height", function(d) {
                return d[dimDelta] ? y(0) - y(d[dimDelta]) : 0;
            })
            .attr("width", colWidth)
        ;

    // add the line
    var valueline  = d3.line() 
            .x(function(d) {
                return x(timeParser(d.date))+(colWidth/2);
            })
            .y(function(d) {
                return d[dimDelta] ? y_2(d[dimDelta]) : y_2(0);            }) 
            ;
    days.shift(); // get rid of first observation when making the line
    vis.append("path")
        .data([days])
        .attr("class","line")
        .attr("d",valueline)
        ;

    vis.selectAll("rect.dimObs").call(d3.helper.tooltip());
    vis.selectAll("rect.dimObsDelta").call(d3.helper.tooltip());
    

    // ------------------------------------------
    // Create the second chart
    // Make the graphs
    // ------------------------------------------
    
    dimension = "confirmed"; // what we always want for this one
    if (sortedLocales.length > 25) {
        sortedLocales.splice(25,sortedLocales.length - 25);
    }
    
    var localeIdx = 0;
    if (selection.indexOf("Country=All") < 0) {
        localeIdx = 1;
    }
    if (selection.indexOf("State=All") < 0) {
        localeIdx = 2;
    }
    for (var k=0;k<sortedLocales.length;k++) {
        var l = sortedLocales[k].locale.split(",");
        if (l.length >= localeIdx + 1) {
            sortedLocales[k].locale = l[localeIdx].trim();
        }
    }

    var svg = d3.select('body').select("#lineLocales div").selectAll("*").remove(); // be sure to get rid of all children (unhook them too?)
    svg = d3.select('body').select("#lineLocales div").html("");

    var x, xAxis, y, yAxis, y_2, y2Axis, xExtent, yExtent, yExtent2;  // core axis definitions that will get reused 
    var timeParser = d3.timeParse("%Y%m%d");
    var timeFormatter = d3.timeFormat("%Y-%m-%d");
    x = d3.scaleBand().domain(sortedLocales.map(d => d.locale)).range([0, width]);
    xAxis   = d3.axisBottom(x).tickSizeOuter(8).ticks(6);
    var colWidth = sortedLocales.length > 1 ? Math.round((x(sortedLocales[1].locale) - x(sortedLocales[0].locale))*.97) : width * .97;

    yExtent = d3.extent(sortedLocales.map(d => d[dimension]));
    yExtent[0] = 0; // always make it zero based
    y       = d3.scaleLinear().domain(yExtent).range([height, 0]);
    yAxis   = d3.axisLeft(y).tickSizeInner(-width).ticks(10);
    var ticks = y.ticks(); // gets the array of ticks that d3 wants to use
    if (ticks[ticks.length - 1] < yExtent[1] ) {  // if the last tick isn't at the max of the chart
        var stride = ticks[1] - ticks[0];                           // determine increment d3 is using
        y.domain([yExtent[0],ticks[ticks.length - 1] + stride]);  // reset the domain
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
        .text("Top Locales");
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
        .text("By confirmed cases, with deaths")
        ;

    svg.append('g')  // y axis label
        .append('text')
        .attr('class','yLabel')
        .attr('transform','rotate(-90)')
        .attr('x',0-(height/2)-margin.t-margin.b)
        .attr('y',16)
        .text("Total");

    // create the space and labeling for the visualization
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

    // Add the bars
    var groups = vis.selectAll("rect")
        .data(sortedLocales)
        .enter().append("g");
    groups.append("rect")
            .attr("class","dimObs")
            .attr("x",function(d) {
                return x(d.locale);
            })
            .attr("y",function(d) {
                return y(d[dimension]);
            })
            .attr("height", function(d) {
                return y(0) - y(d[dimension]);
            })
            .attr("width", colWidth);
    groups.append("rect")  // add the incremental value
            .attr("class","dimObsDied")
            .attr("x",function(d) {
                return x(d.locale);
            })
            .attr("y",function(d) {
                return d.died ? y(d.died) : 0;
            })
            .attr("height", function(d) {
                return d.died ? y(0) - y(d.died) : 0;
            })
            .attr("width", colWidth)
        ;

    vis.selectAll("rect.dimObs").call(d3.helper.tooltip());
    vis.selectAll("rect.dimObsDied").call(d3.helper.tooltip());

    // Hide old tooltip
    d3.select("body").append("div")   
        .attr("class", "tooltip")             
        .style("opacity", 0);

    console.log("Done visualization");
};

return {
	initialize: function() {
        $("#lockButton").click(function() {
            unlocked = !unlocked;
            if (unlocked) {
                $("#lock").hide();
                $("#unlock").show();
            }
            else {
                $("#unlock").hide();
                $("#lock").show();
            }
        })

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

d3.helper = {};

d3.helper.tooltip = function(){
    var tooltipDiv;
    var bodyNode = d3.select('body').node();

    function tooltip(selection){

        selection.on('mouseover.tooltip', function(pD, pI){
            if (Array.isArray(pD)) {
                pData = pD[pI];
            }
            else {
                var pData = pD;
            }
            // Clean up lost tooltips
            d3.select('body').selectAll('div.tooltip').remove();
            // Append tooltip
            tooltipDiv = d3.select('body')
                           .append('div')
                           .attr('class', 'tooltip');
            var absoluteMousePos = d3.mouse(bodyNode);
            tooltipDiv.style({
                left: (absoluteMousePos[0] + 10)+'px',
                top: (absoluteMousePos[1] + 30)+'px',
                padding: '5px',
                position: 'absolute',
                'z-index': 1001
            });
            
            var locale = pData.locale ? pData.locale+" @ " : "";
            var ohtml = [locale+pData.date.substr(0,4)+"-"+pData.date.substr(4,2)+"-"+pData.date.substr(6,2)+"<br/>"];
            var fmt = d3.format(",.0f");
            var fmtPct = d3.format("3.1f");
            ohtml.push("Confirmed: "+fmt(pData.confirmed)+" ("+fmt(pData.confirmedDelta)+")<br>");
            ohtml.push("Died: "+fmt(pData.died)+" ("+fmt(pData.diedDelta)+")<br>");
            ohtml.push("Recovered: "+fmt(pData.recovered)+" ("+fmt(pData.recoveredDelta)+")<br>");
            ohtml.push("Active: "+fmt(pData.active)+" ("+fmt(pData.activeDelta)+")<br>");
            ohtml.push(fmtPct(100*pData.died/pData.confirmed)+"% of confirmed died<br>");
            ohtml.push("Population: "+fmt(pData.population)+"<br>");
            ohtml.push(fmt(pData.conf100k)+" total cases / 100K people<br>");
            ohtml.push(fmtPct(pData.new100k)+" new cases / 100K people<br>");
            ohtml.push(fmtPct(pData.died/(pData.population/100000))+" died / 100K people<br>");

            tooltipDiv.html(ohtml.join(""));
        })
        .on('mousemove.tooltip', function(pD, pI){
            // Move tooltip
            var absoluteMousePos = d3.mouse(bodyNode);
            var node=d3.select("div.tooltip").node();
            if (node === null || typeof tooltipDiv === "undefined" || tooltipDiv === null) {
                return;  // because we haven't drawn it yet?
            }
            var rect = node.getBoundingClientRect();
            var w = window,
                d = document,
                e = d.documentElement,
                g = d.getElementsByTagName('body')[0],
                xwide = w.innerWidth || e.clientWidth || g.clientWidth,
                yhigh = w.innerHeight|| e.clientHeight|| g.clientHeight;
            var left = absoluteMousePos[0] + 10;
            var top = absoluteMousePos[1] + 30;
            if (left + rect.width >= xwide - 20) {  // too wide--flip around
                left = absoluteMousePos[0] - 10 - rect.width;
            }
            if (top + rect.height >= yhigh - 20) {  // too high--flip around
                 top = absoluteMousePos[1] - rect.height;
            }
            tooltipDiv.style("left",left+"px");
            tooltipDiv.style("top",top+"px");
        })
        .on('mouseout.tooltip', function(pD, pI){
            // Remove tooltip
            tooltipDiv.remove();
        })
        ;

    }

    tooltip.attr = function(_x){
        if (!arguments.length) return attrs;
        attrs = _x;
        return this;
    };

    tooltip.style = function(_x){
        if (!arguments.length) return styles;
        styles = _x;
        return this;
    };

    return tooltip;
};


// Custom event polyfill required for IE
(function () {

  if ( typeof window.CustomEvent === "function" ) return false;

  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();
