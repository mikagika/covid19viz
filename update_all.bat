sed -i '/2021-09-09/d' html/data/covid19_daily_reports_all.csv 
grep "2021-09-09" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
