# grafana_demo

## Demo ideas:

* Hive monitoring, three separate hives (three separate jobs), based on my own hives
* Monitoring:
	* One dashboard with machines (separate apps) located in the hives sending the metric data:
		* CPU/memory/IOPS/internal temperature
	* One dashboard for each hive:
		* BPM (Bees Per Minute) in/out of the hive
		* Current temperatures at top and bottom of hive (these are also a gauge)
		* Current humidity at top/bottom of hive (also a gauge)
		* Maximum number of bees out that day (reset count at midnight)
		* Temperature and humidity buckets [-10 -> 0, 0, ->10, 0->20, 20->30, 30->40, 40->50] and [0->10, 10->20, 20->40, 40->100]
		* Current ambient temperature and humidity
		* Number of bees out buckets? [0->1000, 1000->5000, 5000->10000, 10000->20000, 20000+]
		* Current weight of hive (because as weight goes up, you get more of an idea of how full the supers/brood are and how close you are to harvesting the honey)
		* Buckets of current bee counts over the course of the day, 
	* One dashboard for all hives, with pertinent graphs all across time:
		* Temperature
		* Humidity
		* Maximum number of bees out that day
		* Current number of bees out that day
	* Alerts:
		* Humidity > 40% (problem with potential mould)
		* Temperature > 37C (potentially overheating hive) or the ambient temperature (no bees left in hive)
		* Number of bees out > 25k (potential swarm alert)
		* Weight of hive > 20kg (honey ready for harvesting)
	* Logging:
		* Midnight statistics count: max number out that day, what the max and min temps were, max and min humidity, starting weight/end weight
		* Current internal CPU temperature at regular intervals
		* When the server can’t be communicated with (so we simulate dropped packets here occasionally)
		* Kernel messages, perhaps (dropped network interface or something)
* Simulation:
	* Endpoint to three different hives:
		* Set temperature - quick ramp up/down to that temp
		* Set humidity - 
		* Set number of bees going out, and number going in - set a ramp figure so that a swarm can be simulated, where the number of bees going out increase over a minute period up to 15k out, with few coming back in, which then drops the number going back out to a far lower value. THIS WILL CAUSE AN ALERT. (This will also cause a drop in temperature of the hive at the same time as fewer bees will be present)
		* Set the weight of the hive (simulate harvesting too so that it drops off once taken off back to original starting weight)
	* Start the simulation with a couple of days worth of data (so get this done first before observability presentation), and then ensure the endpoints work and cause alerts
	* Simulate sigfox, so data every 12minutes. should account for the lumpiness

Questions:
	* Can I preload data into Prometheus by making a lot of calls with particular datestamps and then having Prom scrap the client? Hopefully so, cause then I don’t have to worry about letting data trickle in slowly over days



## Getting started:

docker-compose manifest includes all the parts of the project:
* Three parts of Grafana:
    * Prometheus - for scraping metrics from services
    * Loki - For storing logs
    * Grafana - For graphing the scraped metrics in various forms
    
    All are based on docker images
* Node server which simulates and exposes beehive metric data

