% Problem:  Taylor series
% Topic:    Polynomial approximation (3) / Slide 7/73
% Author:   M. Boussé, P. Collins
% Version:  06/04/2022

close all; clear variables; clc;

%% define function and plot

f = @(x) sin(x);
figure, fplot(f,[-2*pi,2*pi]);

%% first-order Taylor approximation

p1 = @(x) x;
hold on, fplot(p1,[-2 2]);

%% third-order Taylor approximation

p3 = @(x) x - 1/6*x.^3;
fplot(p3,[-pi,pi]);

%% fifth-order Taylor approximation

p5 = @(x) x - 1/6*x.^3 + 1/120*x.^5;
fplot(p5,[-1.3*pi,1.3*pi]);

% todo: take 21th-order Taylor approximation