clear variables; close all; clc;

format long

f = @(x) x^2 - 2;
df = @(x) 2*x;

r = newton_root(f,df,1.5,eps)