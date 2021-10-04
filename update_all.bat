sed -i '/2021-10-03/d' html/data/covid19_daily_reports_all.csv 
grep "2021-10-03" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
