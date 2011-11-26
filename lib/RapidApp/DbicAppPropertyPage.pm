package RapidApp::DbicAppPropertyPage;
use strict;
use warnings;
use Moose;

extends 'RapidApp::AppDataStore2';
with 'RapidApp::Role::DbicLink2';

use RapidApp::DBIC::Component::TableSpec;

use RapidApp::DbicAppPropertyPage1;

# All-purpose record display module. Works great with AppGrid2/DbicLink2 like this:
#
#has 'open_record_class'	=> ( is => 'ro', lazy => 1, default => sub {
#	my $self = shift;
#	{ 
#		class 	=> 'RapidApp::DbicAppPropertyPage',
#		params	=> {
#			ResultSource => $self->ResultSource,
#			record_pk => $self->record_pk
#		}
#	}
#});


use RapidApp::Include qw(sugar perlutil);

has 'ResultSource' => ( is => 'ro', required => 1 );


#has '+DataStore_build_params' => ( default => sub {{
#	store_autoLoad => 1,
#	reload_on_save => 0,
#}});


sub BUILD {
	my $self = shift;
	
	
	# WTF!!!!!!!!!! Without this the whole world breaks and I have no idea why
	# FIXME!!!!!
	$self->apply_init_modules( item => { 
		class 	=> 'RapidApp::DbicAppPropertyPage1',
		params	=> { 
			ResultSource => $self->ResultSource, 
			record_pk => $self->record_pk,
		}
	});

	$self->apply_extconfig(
		xtype => 'panel',
		layout => 'anchor',
		autoScroll => \1,
		frame => \1,
	);
	
	$self->init_multi_rel_modules;
	
	$self->add_ONCONTENT_calls('apply_items_config');
}


# Adds sub Modules for each included multi relationship. These are then used later on
# each request/when the page is rendered
sub init_multi_rel_modules {
	my $self = shift;
	
	my $TableSpec = $self->TableSpec;
	
	foreach my $rel (@{$TableSpec->related_TableSpec_order}) {
		my $info = $self->ResultSource->relationship_info($rel);
		next unless ($info->{attrs}->{accessor} eq 'multi');
		
		my $RelTS = $TableSpec->related_TableSpec->{$rel};
		
		my $cond_data = RapidApp::DBIC::Component::TableSpec->parse_relationship_cond($info->{cond});
		
		my $Source = $self->ResultSource->related_source($rel);
		
		$self->apply_init_modules( 'rel_' . $rel => {
			class 	=> 'RapidApp::DbicAppGrid3',
			params	=> {
				ResultSource => $Source,
				include_colspec => $RelTS->include_colspec->colspecs,
				get_ResultSet => sub {
					return $Source->resultset->search_rs({ 'me.' . $cond_data->{foreign} => $self->supplied_id });
				}
			}
		});
	}
}


sub supplied_id {
	my $self = shift;
	my $id = $self->c->req->params->{$self->record_pk};
	if (not defined $id and $self->c->req->params->{orig_params}) {
		my $orig_params = $self->json->decode($self->c->req->params->{orig_params});
		$id = $orig_params->{$self->record_pk};
	}
	return $id;
}

sub ResultSet {
	my $self = shift;
	my $Rs = shift;

	my $value = $self->supplied_id;
	return $Rs->search_rs($self->record_pk_cond($value));
}


sub req_Row {
	my $self = shift;
	return $self->_ResultSet->first;
}

sub apply_items_config {
	my $self = shift;
	
	$self->apply_extconfig( items => [ $self->full_property_grid ] );
}

sub full_property_grid {
	my $self = shift;
	
	my @items = $self->TableSpec_property_grids($self->TableSpec);
	
	my $last = pop @items;
	push @items, $last unless (ref($last) eq 'HASH' and $last->{xtype} eq 'spacer');
	
	return @items;
}
sub TableSpec_property_grids {
	my $self = shift;
	my $TableSpec = shift;
	my $Row = shift || $self->req_Row;
	
	return $self->not_found_content unless ($Row);
	
	my %cols = map { $_->{name} => $_ } @{ $self->column_list };
	my @columns = map { $cols{$_} } $TableSpec->local_column_names;
	my $fields = \@columns;
	
	my $title = $TableSpec->relspec_prefix;
	$title = $self->TableSpec->name . '.' . $title unless ($title eq '');
	$title = $self->TableSpec->name if ($title eq '');
	
	my $icon = $TableSpec->get_Cnf('singleIconCls');
	
	my $cnftitle = $TableSpec->get_Cnf('title');
	$title = $cnftitle . ' (' . $title . ')' unless ($TableSpec->name eq $cnftitle);

	my @items = ();
	my @multi_items = ();
	push @items, $self->property_grid($title,$icon,$fields), { xtype => 'spacer', height => 5 } if (@$fields > 0);
	#my @TableSpecs = map { $TableSpec->related_TableSpec->{$_} } @{$TableSpec->related_TableSpec_order};
	
	my @TableSpecs = ();
	
	foreach my $rel (@{$TableSpec->related_TableSpec_order}) {
		my $relRow = $Row->$rel or next;
		if($relRow->isa('DBIx::Class::Row')) {
			push @items, $self->TableSpec_property_grids($TableSpec->related_TableSpec->{$rel},$relRow);
		
			
		}
		elsif($relRow->isa('DBIx::Class::ResultSet')) {
		
			my $RelTS = $TableSpec->related_TableSpec->{$rel};
		
			push @multi_items, {
				%{ $self->Module('rel_' . $rel)->content },
				autoWidth		=> \1,
				collapsible => \1,
				collapseFirst => \1,
				titleCollapse => \1,
				#height => 400,
				autoHeight => \1,
				title => $RelTS->get_Cnf('title_multi') . ' (' . $rel . ')',
				iconCls => $RelTS->get_Cnf('multiIconCls'),
				gridsearch			=> undef,
				pageSize			=> undef,
				use_multifilters	=> \0,
				viewConfig => { emptyText => '<span style="color:darkgrey;">(No ' . $RelTS->get_Cnf('title_multi') . ')</span>' },
				# Why do I have to set this manually?
				bodyStyle => 'border: 1px solid #D0D0D0;',
			};
		}
	}
	
	unshift @multi_items, { xtype => 'spacer', height => 5 } if (@multi_items > 0);
	
	return @items,@multi_items;
}



sub property_grid {
	my $self = shift;
	my $title = shift;
	my $icon = shift;
	my $fields = shift;
	my $opt = shift || {};
	
	my $conf = {
		
		autoWidth		=> \1,
		#bodyCssClass => 'sbl-panel-body-noborder',
		bodyStyle => 'border: 1px solid #D0D0D0;',
		collapsible => \1,
		collapseFirst => \0,
		titleCollapse => \1,
		autoHeight => \1,
		title => $title,
		iconCls => $icon,
		xtype => 'apppropertygrid',
		hideHeaders => \1,
		autoHeight => \1,
		editable => \1,
		fields => $fields,
		store => $self->getStore_func,
		nameWidth => 250,
		
		sm => RapidApp::JSONFunc->new( func => 'new Ext.grid.RowSelectionModel', parm => {
			listeners => {
				# Disable row selection (note that disableSelection doesn't work in propertygrid with 'source')
				beforerowselect => RapidApp::JSONFunc->new( raw => 1, func => 'function() { return false; }' )
			}
		}),
		plugins => [ 'titlecollapseplus' ]
	};
	
	return merge($conf,$opt);
}

sub not_found_content {
	my $self = shift;
	
	my $msg = 'Record not found';
	my $id = $self->supplied_id;
	$msg = "Record ($id) not found" if ($id);
	
	return { html => '<pre>' . $msg . '</pre>' };
}


1;


