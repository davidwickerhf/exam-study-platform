% Problem:  Lagrange basis for spike
% Topic:    Polynomial Interpolation (3) / Slide 45/73
% Author:   M. Boussé, P. Collins
% Version:  13/04/2022

clear variables; close all; clc;

%% define points

m = 4;
n = 2*m;                % degree
xs = [-m:m];
ys = zeros(1,n+1);
ys(m+1) = 1;

figure, plot(xs,ys,'s'),
axis([-m-0.5 m+0.5 -1.5 1.5])

%% compute fit in Lagrange basis

cs = polyfit(xs,ys,n);
p = @(x) polyval(cs,x);

p(xs) % seems about right

%% plot polynomial

hold on, fplot(p,[-m,m]), hold off;
