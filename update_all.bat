sed -i '/2020-11-30/d' html/data/covid19_daily_reports_all.csv 
grep "2020-11-30" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
