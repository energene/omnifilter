var nooocl = require('nooocl');
var CLHost = nooocl.CLHost;
var CLPlatform = nooocl.CLPlatform;
var CLDevice = nooocl.CLDevice;
var CLContext = nooocl.CLContext;
var CLBuffer = nooocl.CLBuffer;
var CLCommandQueue = nooocl.CLCommandQueue;
var CLUserEvent = nooocl.CLUserEvent;
var NDRange = nooocl.NDRange;
var CLProgram = nooocl.CLProgram;
var CLKernel = nooocl.CLKernel;
var CLImage2D = nooocl.CLImage2D;
var CLImage3D = nooocl.CLImage3D;
var CLSampler = nooocl.CLSampler;

var assert = require("assert");
var ref = require("ref");
var testHelpers = require("./testHelpers");
var path = require("path");
var Bluebird = require("bluebird");
var fs = Bluebird.promisifyAll(require("fs"));
var cd = __dirname;
var jpeg = require("jpeg-js");

testHelpers.doTest(function (env) {

  var host = env.host;
  var context = env.context;
  var device = env.device;
  return fs.readFileAsync(path.join(cd, "doorskel.jpg")).then(function (data) {
    var inputImage = jpeg.decode(data);
    var queue = new CLCommandQueue(context, device);
    var format = new (host.cl.types.ImageFormat)({
      imageChannelOrder: host.cl.defs.CL_RGBA,
      imageChannelDataType: host.cl.defs.CL_UNSIGNED_INT8
    });
    var src = CLImage2D.wrapReadOnly(context, format, inputImage.width, inputImage.height, inputImage.data);
    var outputData = new Buffer(inputImage.data.length);
    var dst = CLImage2D.wrapWriteOnly(context, format, inputImage.width, inputImage.height, outputData);
    return fs.readFileAsync(path.join(cd, "toGrey.cl"), "utf8").then(
      function (source) {
        var program = context.createProgram(source);
        return program.build().then(function () {
          var buildStatus = program.getBuildStatus(device);
          if (buildStatus < 0) {
            assert.fail("Build failed.\n" + program.getBuildLog(device));
          }
          var kernel = program.createKernel("toGrey");
          kernel.setArgs(src, dst);
          queue.enqueueNDRangeKernel(kernel, new NDRange(inputImage.width, inputImage.height), null, null);
          var out = {};
          var origin = new NDRange(0, 0, 0);
          var region = new NDRange(inputImage.width, inputImage.height, 1);
          return queue.waitable().enqueueMapImage(dst, host.cl.defs.CL_MAP_READ, origin, region, out).promise
          .then(function () {
            assert(out.ptr ? true : false);
            assert.equal(out.rowPitch, inputImage.width * 4);
            assert.equal(ref.address(out.ptr), ref.address(outputData));

            var outputImage = {
              width: inputImage.width,
              height: inputImage.height,
              data: outputData
            };

            var jpegData = jpeg.encode(outputImage, 85);

            return fs.writeFileAsync(path.join(cd, "out.jpg"), jpegData.data, "binary").finally(
              function () {
                return queue.waitable().enqueueUnmapMemory(dst, out.ptr).promise;
              });
            });
          });
        });
      });
    }
);
