var testFlag = true;
var vm = null;
// 地图选择 打点
var taggingMarkers = null;
var xy = null;
var object = null;
var tag = "tag0";
var tagSquence = 0;
var map, layer25D;
var trans = new Transformation(45, 45, 49); // 坐标转换对象
var updateTag = function () {
  tagSquence++;
  tag = "tag" + tagSquence;
};
var mapload = function (list, center) {
  if (map) return;
  var config = new OMAP.Config({
    imagePath: UICore.mapServiceUrl + "image",
    jsPath: UICore.mapServiceUrl + "resource/js/",
    mapId: 1,
    scale: 0.353,
    hotFileLevel: 5,
    overlook: Math.PI / 4,
    rotate: Math.PI / 4
  });
  layer25D = new OMAP.Layer.NOGISLayer("25D", UICore.mapServiceUrl + "resource/", {
    isBaseLayer: true,
    transparent: true,
    defaultImage: '../script/Nogis-api/img/transparent.png',
    loadHotspot: false,
    hotspotTouch: null
  });
  var ext = new OMAP.Bounds(-56255400.354765005, -56255400.354765005, 56255400.354765005, 56255400.354765005);
  var mapCenter = UICore.mapCenter;
  if (center) {
    mapCenter = [center.x, center.y];
  }
  // 地图配置
  var mapOptions = {
    extent: ext,
    center: mapCenter,
    zoom: 4,
    config: config,
    resolutions: [
      107.29866095498084608,
      53.64933047749042304,
      26.82466523874521152,
      13.41233261937260576,
      6.70616630968630288,
      3.35308315484315144,
      1.67654157742157572,
      0.83827078871078786,
      0.41913539435539393
    ],
    numZoomLevels: 9,
    layers: [layer25D],
    controls: [new OMAP.Control.Navigation()]
  };
  // 初始化地图
  map = new OMAP.Map("mapDiv", mapOptions);
  if (list) {
    init_EditPolygon(list);
  }
  // 打上标注
  taggingMarkers = new OMAP.Layer.Markers("Markers");
  map.addLayer(taggingMarkers);
  vm.getLocation();
}

// 打上标注
function init_addTagging(x, y) {
  taggingMarkers.clearMarkers();
  var size = new OMAP.Size(21, 25);
  var offset = new OMAP.Pixel(-(size.w / 2), -size.h);
  var icon = new OMAP.Icon('../../image/icon/icon220px.png', size, offset);
  var marker = new OMAP.Marker(new OMAP.LonLat(x, y), icon);
  taggingMarkers.addMarker(marker);
}

// 画斑图
function init_EditPolygon(list) {
  var scaleStyle = { // 面的样式
    strokeWidth: 2,
    strokeOpacity: 1,
    strokeColor: "red",
    fillColor: "white",
    fillOpacity: 0.3
  };
  var scaleLayer = new OMAP.Layer.Vector("scaleLayer", {
    style: scaleStyle
  });
  map.addLayer(scaleLayer);
  var pts = [];
  for (var i = 0, len = list.length; i < len; i++) {
    var pt = new OMAP.Geometry.Point(list[i].x, list[i].y);
    pts.push(pt);
  }
  var ring = new OMAP.Geometry.LinearRing(pts);
  var p = new OMAP.Geometry.Polygon(ring);
  var b = new OMAP.Feature.Vector(p);
  scaleLayer.addFeatures(b);

  editlayer = new OMAP.Layer.Vector("drawLayer");
  map.addLayer(editlayer);
  editlayer.addFeatures([b]);
  var modifyControl = new OMAP.Control.ModifyFeature(editlayer);
  map.addControl(modifyControl);
  modifyControl.mode = OMAP.Control.ModifyFeature.RESHAPE
    | OMAP.Control.ModifyFeature.DRAG;
  modifyControl.activate();
}

apiready = function () {
  vm = new Vue({
    el: "#list",
    data: {
      flag: api.pageParam.flag,
      accountId: '',
      // 判断是否进入考勤范围 true 进入， false 没有进入
      isAttendance: false,
      // 画版图
      list: [],
      center: {},
      type: 3,
      toWorkTime: '',
      outWorkTime: '',
      x: '',
      y: ''
    },
    created() {
      this._initData();
    },
    methods: {
      // 初始化数据
      _initData() {
        var info = $api.getStorage('userinf');
        this.accountId = info.accountId;
        // 记得删除
        // if (testFlag) {
        //   this.accountId = 'ff80808148adba0f0148b0c01b935043';
        // }
        // 获取打卡数据
        var url = UICore.serviceUrl + 'mobile/mobileWf.shtml?act=getGraphics&accountId=' + this.accountId;
        api.ajax({
          url: url,
          method: 'get',
        }, function (ret, err) {
          if (ret.success == true) {
            vm.list = ret.list;
            vm.center = ret.object;
            vm._initMap(ret.list, ret.object);
          } else {
            if (ret.message) {
              api.toast({
                msg: ret.message,
                duration: 2000,
                location: 'bottom'
              });
            } else {
              api.toast({
                msg: '接口错误',
                duration: 2000,
                location: 'bottom'
              });
            }
          }
        })
        // 判断是否打卡
        this.isPunch();
      },
      // 初始化地图
      _initMap(list, object) {
        if(object){
          mapcontainer.style.display = "block";
          mapload(list, object);
        }else{
          this.type = 3;
          api.toast({
            msg: '无法打卡',
            duration: 2000,
            global: 'true',
            location: 'bottom'
          });
        }
      },
      // 重新定位个人位置
      refreshLocation() {
        if(this.type == 3){
          api.toast({
            msg: '数据出错，无法定位',
            duration: 2000,
            global: 'true',
            location: 'bottom'
          });
          return false;
        }else{
          this.getLocation();
        }
        
      },
      // 定位坐标位置
      getLocation: function () {
        api.showProgress({
          title: '定位中...',
          text: '请稍后...',
          modal: false
        });
        var baiduLocation = api.require('baiduLocation');
        baiduLocation.startLocation({
          accuracy: '10m',
          filter: 5,
          autoStop: true,
        }, function (ret, err) {
          if (ret.status) {
            var latitude = ret.latitude;// 纬度，浮点数，范围为90 ~ -90
            var longitude = ret.longitude// 经度，浮点数，范围为180 ~ -180。
            var accuracy = ret.accuracy;// 位置精度
            // var gcj02 = bd09togcj02(longitude,latitude);
            // var wgs84 = gcj02towgs84(gcj02[0],gcj02[1]);
            var coordTran2 = new Transformation2(45, 45, 49);
            var myxy = coordTran2.bd09towgs84(longitude, latitude)
            var loc = coordTran2.WGS842OCN(myxy.x, myxy.y);
            // alert(loc.x);
            if (testFlag) {
              loc.x = vm.list[0].x;
              loc.y = vm.list[0].y;
            }
            vm.x = loc.x;
            vm.y = loc.y;
            init_addTagging(loc.x, loc.y);
            // 判断他在不在网格内
            api.hideProgress();
            vm.isCanPunch(loc.x, loc.y);
          } else {
            api.hideProgress();
            alert("定位失败");
          }
        });
      },
      // 判断是否打开
      isPunch() {
        var url = UICore.serviceUrl + 'mobile/mobileWf.shtml?act=checkClockIn&accountId=' + this.accountId;
        api.ajax({
          url: url,
          method: 'get',
        }, function (ret, err) {
          if (ret.success == true) {
            // alert(JSON.stringify(ret.object));
            vm.type = ret.type;
            vm.toWorkTime = ret.object.toWorkTime;
            vm.outWorkTime = ret.object.outWorkTime;
            window.localStorage.setItem('punch', ret.type);
          } else {
            if (ret.message) {
              api.toast({
                msg: ret.message,
                duration: 2000,
                location: 'bottom'
              });
            } else {
              api.toast({
                msg: '接口错误',
                duration: 2000,
                location: 'bottom'
              });
            }
          }
        })
      },
      // 打卡
      punch() {
        if(this.type == 3){
          api.toast({
            msg: '数据出错，无法打卡',
            duration: 2000,
            global: 'true',
            location: 'bottom'
          });
          return false;
        }
        if (this.type == 2) {
          api.toast({
            msg: '您今天已打卡',
            duration: 2000,
            global: 'true',
            location: 'bottom'
          });
          return false;
        }
        if (!this.isAttendance) {
          api.toast({
            msg: '很抱歉，您不在打卡范围内。',
            duration: 2000,
            global: 'true',
            location: 'bottom'
          });
          return false;
        }

        var url = UICore.serviceUrl + 'mobile/mobileWf.shtml?act=clockIn&accountId=' + this.accountId + '&x=' + this.x + '&y=' + this.y + '&state=' + this.type;
        api.confirm({
          title: '打卡',
          msg: '是否打卡?',
          buttons: ['确定', '取消']
        }, function (ret, err) {
          var index = ret.buttonIndex;
          if (index == 1) {
            api.showProgress({
              title: '打卡中...',
              text: '请稍后...',
              modal: false
            });
            api.ajax({
              url: url,
              method: 'get',
            }, function (ret, err) {
              api.hideProgress();
              if (ret.success == true) {
                if (ret.message) {
                  api.toast({
                    msg: ret.message,
                    duration: 2000,
                    location: 'bottom'
                  });
                }
                window.localStorage.setItem('punch', vm.type);
                vm.isPunch();
              } else {
                if (ret.message) {
                  api.toast({
                    msg: ret.message,
                    duration: 2000,
                    location: 'bottom'
                  });
                } else {
                  api.toast({
                    msg: '接口错误',
                    duration: 2000,
                    location: 'bottom'
                  });
                }
              }
            });
          }
        });


      },
      // 判断是否在打卡范围内
      isCanPunch(x, y) {
        var url = UICore.serviceUrl + 'mobile/mobileWf.shtml?act=checkDistance&accountId=' + this.accountId + '&x=' + x + '&y=' + y;
        api.ajax({
          url: url,
          method: 'get',
        }, function (ret, err) {
          vm.isAttendance = ret.success;
        })
      },
      submit: function () {
        if (!xy) {
          api.toast({
            msg: '请打点',
            duration: 3000,
            global: 'true',
            location: 'bottom'
          });
          return false;
        }
        api.sendEvent({
          name: 'mapMarkXy',
          extra: {
            xy: xy
          }
        });
      },
      closeWin: function () {
        api.closeWin();
      }
    }
  });
}


