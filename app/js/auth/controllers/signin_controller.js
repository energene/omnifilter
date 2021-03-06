module.exports = function(app) {
  app.controller('SigninController', ['$scope', 'userAuth', '$location', function($scope, auth, $location) {
    $scope.submit = function(user) {
      auth.signIn(user, function() {
        $scope.updateEmail();
        $location.path('/home');
      });
    };
  }]);
};
