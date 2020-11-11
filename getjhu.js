#!/usr/bin/jjs -scripting 

/* global readFully, $OUT, java, Java, $ARG */

/* 
This script reads a daily reporting file from John Hopkins and reformats it to the format we want
Note that this is set up to work with my personal directory config. Sorry. 
*/

var inlog='03-22-2020.csv';
var outcsv='covid19_daily_reports.csv';
var batfile = 'update_all.bat';
var allcsv = 'covid19_daily_reports_all.csv';

var now = new Date();
now.setHours(now.getHours()-24); // yesterday
inlog = zeroPad(now.getMonth()+1)+"-"+zeroPad(now.getDate())+"-"+now.getFullYear()+".csv";

if ($ARG.length > 0 && $ARG[0] === "--") {
    $ARG.shift(); // because sometimes the come through!?!
}

if ($ARG.length > 0) {
    inlog=$ARG[0];
}
if ($ARG.length > 1) {
    outcsv=$ARG[1];
}

var fileDate = inlog.substr(6,4)+"-"+inlog.substr(0,2)+"-"+inlog.substr(3,2);
print("Will use data date of "+fileDate);

var dateFile = new Date(inlog.substr(6,4),inlog.substr(0,2) - 1,inlog.substr(3,2));
var dc = new Date();
dc = dc.setDate(dateFile.getDate() - 130);  // this 130 because 100 + 30 days rolling is the cutoff in the UI
var cutoffDate = formatDate(dc);
print("Will use a cutoff date of "+cutoffDate+" for the daily file");

if (inlog.indexOf("/") < 0) {
    inlog = "../COVID-19/csse_covid_19_data/csse_covid_19_daily_reports/"+inlog;
}
if (outcsv.indexOf("/") < 0) {
    outcsv = "html/data/"+outcsv;
}
if (allcsv.indexOf("/") < 0) {
    allcsv = "html/data/"+allcsv;
}

print("Reading log file: "+inlog+", writing to "+outcsv);

var covid = {obs:[],
    country: {idx:{},list:[]},
    date: {idx:{},list:[]}
    };

var keys = {};

getCovidData(readFully(outcsv));

var lines = readFully(inlog).split("\n");
var version = checkVersion(lines[0]);

if (version === 0) {
    print("Header unrecognized");
    print(lines[0]);
    exit(1);
}

var c = 0;
print("Reading "+lines.length+" new data lines");
for (var k=1;k<lines.length;k++) {
    var data = lines[k].split(",");
    data = handleQuotes(data);
    if (data && data.length >= 11) {
        data[data.length - 1] = data[data.length - 1].replace("\r","");
        var tobs = {};
        if (version >= 2) {
            tobs.fips = data[0];
            tobs.country = data[3];
            tobs.state = data[2];
            tobs.county = data[1];
            //tobs.date = data[4];  // change as of 4/24 to use the file date, not last update timestamp
            tobs.date = fileDate;
            tobs.confirmed = data[7];
            tobs.died = data[8];
            tobs.recovered = data[9];
            tobs.active = data[10];
            var parts = tobs.date.split("-");
            if (parts.length >= 3) {
                parts[2] = parts[2] ? parts[2].substr(0,2) : parts[2];
                //tobs.date = parts[0]+"-"+zeroPad(parts[1])+"-"+zeroPad(parts[2]);
            }
            /*
            else {
                parts = tobs.date.split("/");
                if (parts.length < 3) {
                    print("Possible bad date: "+tobs.date);
                }
                else {
                    parts[2] = parts[2] ? parts[2].substr(0,2) : parts[2];
                    var old = tobs.date;
                    tobs.date = "20"+parts[2]+"-"+zeroPad(parts[0])+"-"+zeroPad(parts[1]);
                    //print("Unexpected old date format "+old+" converted to "+tobs.date);
                }
            }
            */
        }
        if (version === 3) {
            // not currently using these
            //tobs.incidence = data[12];
            //tobs.cfr = data[13];
        }
        var thisKey = tobs.country+tobs.state+tobs.county+tobs.date;
        if (!keys[thisKey]) {
            covid.obs.push(tobs);
            //updateIndexes(tobs);
            keys[thisKey] = covid.obs.length; // so we'll always be > 0, i.e. truthy
            if (c++<10) {
                print("Added: "+lines[k]);
            }
        }
        else {
            var oobs = covid.obs[keys[thisKey]-1];
            covid.obs[keys[thisKey]-1] = tobs; // because we stored the length, not the index
            if (JSON.stringify(oobs) != JSON.stringify(tobs)) {
                print("Updating "+tobs.country+" "+tobs.state+" "+tobs.county+" "+tobs.date)
                print("  Was: "+JSON.stringify(oobs));
                print("  Now: "+JSON.stringify(tobs));
            }
        }    
    }
}

covid.obs.sort(function(a,b) {
    if (a.country != b.country) {
        return a.country < b.country ? -1 : 1;
    }
    else {
        if (a.state != b.state) {
            return a.state < b.state ? -1 : 1;
        }
        else {
            if (a.county != b.county) {
                return a.county < b.county ? -1 : 1;
            }
            else {
                if (a.date != b.date) {
                    return a.date < b.date ? -1 : 1;
                }
                else {
                    return 0;
                }
            }
        }
    }
});

var FileWriter=Java.type("java.io.FileWriter");  // we'll need this later for writing out the files
var fw = new FileWriter(outcsv);
fw.write("FIPS,Country,State,County,Date,Confirmed,Died,Recovered,Active\n");
for (var k=0;k<covid.obs.length;k++) {
    var c = covid.obs[k];
    fw.write(c.fips+","+c.country+","+c.state+","+c.county+","+c.date+","+c.confirmed+","+c.died+","+c.recovered+","+c.active+"\n");
}
fw.close();

print("Wrote "+covid.obs.length+" lines");

// write a new batch file to delete today's data from the full csv and then add it back in
var fw = new FileWriter(batfile);
fw.write("sed -i '/"+fileDate+"/d' "+allcsv+" \r\n");
fw.write('grep "'+fileDate+'" '+outcsv+' >>'+allcsv+' \r\n');
fw.close();

exit(0);

function handleQuotes(items) {
    var out = [];
    var hold = '';
    for (var k=0;k<items.length;k++) {
        if (items[k].substr(0,1) === '"') {
            hold = items[k].substr(1);
        }
        else {
            if (hold > '') {
                var l = items[k].length - 1;
                if (items[k].substr(l) == '"') {
                    hold += items[k].substr(0,l);
                    out.push(hold);
                    hold = '';
                }
                else {
                    hold += items[k];
                }
            }
            else {
                out.push(items[k]);
                hold = '';
            }
        }
    }
    return out;
}
/**
 * Returns a version number for this type of data, 0 = unknown
 * @param {string} line0 
 */
function checkVersion(line0) {
    var v = 0;
    /* not yet supported 
    if (lines[0].trim() == "Province/State,Country/Region,Last Update,Confirmed,Deaths,Recovered,Latitude,Longitude") {
        v = 1;
    }
    */
    if (lines[0].trim() == "FIPS,Admin2,Province_State,Country_Region,Last_Update,Lat,Long_,Confirmed,Deaths,Recovered,Active,Combined_Key") {
        v = 2;
    }
    if (lines[0].trim() == "FIPS,Admin2,Province_State,Country_Region,Last_Update,Lat,Long_,Confirmed,Deaths,Recovered,Active,Combined_Key,Incidence_Rate,Case-Fatality_Ratio" ||
        lines[0].trim() == "FIPS,Admin2,Province_State,Country_Region,Last_Update,Lat,Long_,Confirmed,Deaths,Recovered,Active,Combined_Key,Incident_Rate,Case_Fatality_Ratio") {
        v = 3;
    }
    return v;
}

/**
 * Reads a CSV file and builds an object for us that will have all the relevant details?!?
 * @param {*} csv 
 * updates covid data in a javascript object
 *  obs: array of objects with the 9 data columns
 *  country: an object with 
 *      idx: a map of country names to indexes
 *      list: array of country entries each with
 *          name: name of the country
 *          state: an object with:
 *              idx: a map of state names to indexes
 *              list: an array of state entries with:
 *                  name: name of the state
 *                  county: an object with:
 *                      idx: a map of county names to indexes
 *                      list: an array of county entries with:
 *                          name: name of the county
 * 
 */
function getCovidData(csv) {
    print("Got existing data");
    var lines = csv; // assume an array?
    //print("csv length: "+csv.length);
    //csv = csv.replace("/\r/g","");
    //print("csv length: "+csv.length);
    if (csv.indexOf("\n") >= 0) {
        print("Splitting existing data by newline");
        lines = csv.split("\n");
    }
    print("Reading "+lines.length+" existing data lines");
    if (lines.length < 10000) {
        print("Something went wrong (possible newline change?!?");
        exit(1);
    }
    for (var k=1;k<lines.length;k++) {
        var data = lines[k].split(",");
        if (data && data.length >= 9) {
            //print(data[8].length+" "+data[8]);
            if (data.length === 9) { // we can skip the fixing carriage returns if we have more columns than we use
                data[8] = data[8].replace("\r","");
            }
            if (data[4] < cutoffDate) {
                continue; // skip this old record so we don't write it out
            }
            var tobs = {
                fips: data[0],
                country: data[1], 
                state: data[2],
                county: data[3],
                date: data[4],
                confirmed: data[5],
                died: data[6],
                recovered: data[7],
                active: data[8]
            }
            var idx = covid.obs.length;
            covid.obs.push(tobs);
            //updateIndexes(tobs);
            keys[tobs.country+tobs.state+tobs.county+tobs.date] = covid.obs.length;    
        }
    }
    print("Done reading existing data");
}

/**
 * Add a leading zero to numbers that are less than ten
 * @param {number} n number to be padded
 */
function zeroPad(n) {
    var nn = n<10 ? "0"+n : n;
    return (""+nn).substr(-2,2);
}

/**
 * Split a string into before and after segments based on a regex 
 * @param {string} instring the string to search 
 * @param {regex} splitter regex to match on 
 * @param {boolean} ignoreFirstCharMatch consider the first matching character part of "before"
 * @returns {object}.before part of the string before the match or the entire string if no match 
 * @returns {object}.after null if no match or the part of the string after the match
 */
function splitter(instring, splitter, ignoreFirstCharMatch) {
    var rval = {before:instring};
    if (typeof instring === "undefined") {
        return rval;
    }
    var found = instring.match(splitter);
    if (found && found.index >= 0) {
        var len = found[0].length;
        var idx = found.index;
        if (ignoreFirstCharMatch) {
            rval.before = instring.substring(0,idx+1);
            rval.after = instring.substring(idx+len);
        }
        else {
            rval.before = instring.substring(0,idx);
            rval.after = instring.substring(idx+len);
        }
    }
    return rval;
}

// from https://stackoverflow.com/questions/23593052/format-javascript-date-as-yyyy-mm-dd
// since we don't have .toISOString() available to us in Nashorn
function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}