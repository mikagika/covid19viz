sed -i '/2020-09-11/d' html/data/covid19_daily_reports_all.csv 
grep "2020-09-11" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
