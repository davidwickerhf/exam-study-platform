% Problem:  Runge phenomenon
% Topic:    Polynomial Interpolation (3) / Slide 45/73
% Author:   M. Boussé, P. Collins
% Version:  13/04/2022

clear variables; close all; clc;

%% define points

f = @(x) 1./(1+x.^2);
a = 4;
n = 32; % degree: show 8, 16, 32, 64
xs = linspace(-a,a,n+1);
ys = f(xs);

figure, plot(xs,ys,'s'),
hold on, fplot(f)

%% compute fit in Lagrange basis

cs = polyfit(xs,ys,n);
p = @(x) polyval(cs,x);

%% plot polynomial

hold on, fplot(p,[-a,a]), hold off;

error = max(abs(f([-a:0.1:a]) - p([-a:0.1:a])))
% note: error increases as degree increases