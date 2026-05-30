% Problem:  Splines
% Topic:    Polynomial Interpolation (3) / Slide 54-55/73
% Author:   M. Boussé, P. Collins
% Version:  13/04/2022

clear variables; close all; clc;

%% equidistant

f = @(x) 1./(1+x.^2);
a = 4;
n = 8; % degree: show 8, 16, 32, 64
xs = linspace(-a,a,n+1);
ys = f(xs);

% figure, plot(xs,ys,'s'),

cs = polyfit(xs,ys,n);
p = @(x) polyval(cs,x);

figure, fplot(f,[-a,a],'k--'), hold on, fplot(p,[-a,a]), hold off;

%% chebyshev

xs = -a*cos((2*[0:n]+1)*pi/(2*n+2));
ys = f(xs);

cs = polyfit(xs,ys,n);
p = @(x) polyval(cs,x);

hold on, fplot(p,[-a,a]), hold off;

%% splines

df = @(x) 2*x./(1+x.^2).^2;
wa = df(-a); wb = df(a);
xs = linspace(-a,a,n+1);
ys = f(xs);
S = spline(xs,[wa,ys,wb]);
s = @(x) ppval(S,x);

hold on, fplot(s,[-a,a]), hold off;
legend('true','equidistant nodes','chebychev nodes','spline (w eq. nodes)');


%% fun with splines

clear variables; close all; clc;

[xy,spcv] = getcurve

% pen tool in illustrator
% uses cscvn (cubic spline fitting)