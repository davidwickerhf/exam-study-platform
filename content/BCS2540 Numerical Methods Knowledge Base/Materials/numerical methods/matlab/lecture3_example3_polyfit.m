% Problem:  Polynomial interpolation
% Topic:    Polynomial Interpolation (3) / Slide 19/73
% Author:   M. Boussé, P. Collins
% Version:  11/04/2022

clear variables; close all; clc;

%% load data

xs = [0.0, 0.5, 1.0, 2.0, 3.0];
ys = [1.0, 0.8, 0.5, 0.2, 0.1];
figure, plot(xs,ys,'x','MarkerSize',10)
legend('data')

%% fit a polynomial

cs = polyfit(xs,ys,4)

%% evaluate polynomial

% given points
polyval(cs,xs)

% new point
polyval(cs,1.5)

%% plot polynomial

p = @(x) polyval(cs,x);
hold on, fplot(p,[-0.5,3.5])

% note: what happens if I lower the degree? set d = 2, see later.