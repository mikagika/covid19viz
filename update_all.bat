sed -i '/2021-03-02/d' html/data/covid19_daily_reports_all.csv 
grep "2021-03-02" html/data/covid19_daily_reports.csv >>html/data/covid19_daily_reports_all.csv 
