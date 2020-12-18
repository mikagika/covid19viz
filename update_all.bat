sed -i '/2020-12-17/d' html/data/covid19_daily_reports_all.csv 
grep "2020-12-17" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
