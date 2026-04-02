export const schedulePresets = [
  {
    id: "standard-4day",
    name: "标准4日检测",
    schedules:[
      {
        "startTime": "0",
        "endTime": "15",
        "frequency": "3",
      },
      {
        "startTime": "15",
        "endTime": "60",
        "frequency": "5",
      },
      {
        "startTime": "60",
        "endTime": "240",
        "frequency": "15",
      },
      {
        "startTime": "240",
        "endTime": "5760",
        "frequency": "60",
      }
    ]
  }
];
