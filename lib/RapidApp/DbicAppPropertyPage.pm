package RapidApp::DbicAppPropertyPage;
use strict;
use warnings;
use Moose;

extends 'RapidApp::AppDataStore2';
with 'RapidApp::Role::DbicLink2';

use RapidApp::DBIC::Component::TableSpec;

#use RapidApp::DbicAppPropertyPage1;

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

# -- these aren't working... why ?
has '+single_record_fetch', default => 1;
has '+max_pagesize', default => 1;
# --

has 'exclude_grids_relationships', is => 'ro', isa => 'ArrayRef', default => sub {[]};
has 'exclude_grids_relationships_map', is => 'ro', lazy => 1, isa => 'HashRef', default => sub {
	my $self = shift;
	return { map {$_=>1} @{$self->exclude_grids_relationships} };
};

has 'setup_multi_grids', is => 'ro', isa => 'Bool', default => 1;



#has '+DataStore_build_params' => ( default => sub {{
#	store_autoLoad => 1,
#	reload_on_save => 0,
#}});


our $ONLY_MULTI_GRIDS = 0;

sub BUILD {
	my $self = shift;
	
	$self->apply_extconfig(
		xtype => 'panel',
		layout => 'anchor',
		autoScroll => \1,
		frame => \1,
	);
	
	$self->set_default_tab_icon;
	
	$self->init_multi_rel_modules;
	
	$self->add_ONCONTENT_calls('call_apply_items_config');
}

# --- Handle RESTful URLs - convert 'id/1234' into '?___record_pk=1234'
has '+accept_subargs', default => 1;
before 'prepare_controller' => sub {
	my $self = shift;
	my @args = @_;
	my ($key,$id) = @args;
	
	return unless (lc($key) eq 'id' && $id);
	
	$self->apply_extconfig( tabTitle => $id );
	$self->c->req->params->{$self->record_pk} = $id;
	
	# Need to manually set the baseParams in the store:
	my $baseParams = $self->DataStore->get_extconfig_param('baseParams') || {};
	$baseParams->{$self->record_pk} = $id;
	$self->DataStore->apply_extconfig( baseParams => $baseParams );
};
# ---


sub set_default_tab_icon {
	my $self = shift;
	my $class = $self->ResultClass or return;
	my $iconCls = $class->TableSpec_get_conf('iconCls') or return;
	$self->apply_extconfig( tabIconCls => $iconCls );
}


# Adds sub Modules for each included multi relationship. These are then used later on
# each request/when the page is rendered
sub init_multi_rel_modules {
	my $self = shift;
	my $TableSpec = shift || $self->TableSpec;
	
	#print STDERR RED . 'init_multi_rel_modules: ' . $TableSpec->relspec_prefix . CLEAR . "\n\n";
	
	foreach my $rel (@{$TableSpec->related_TableSpec_order}) {
		
		my $RelTS = $TableSpec->related_TableSpec->{$rel};
		
		# Recursive:
		$self->init_multi_rel_modules($RelTS);
		
		my $info = $TableSpec->ResultSource->relationship_info($rel);
		next unless ($info->{attrs}->{accessor} eq 'multi');
		
		my $cond_data = RapidApp::DBIC::Component::TableSpec->parse_relationship_cond($info->{cond});
		
		my $Source = $TableSpec->ResultSource->related_source($rel);
		
		my $mod_name = 'rel_' . $RelTS->column_prefix . $rel;
		
		my $mod_params = {
			include_colspec => $RelTS->include_colspec->init_colspecs,
			updatable_colspec => $RelTS->updatable_colspec->init_colspecs
		};
		
		my $colname = $TableSpec->column_prefix . $rel;
		
		
		
=pod		
		# If this rel/colname is updatable in the top TableSpec, then that translates
		# into these multi rel rows being addable/deletable
		if ($self->TableSpec->colspec_matches_columns($self->TableSpec->updatable_colspec->colspecs,$colname)){
			$mod_params->{creatable_colspec} = $RelTS->creatable_colspec->init_colspecs;
			$mod_params->{destroyable_relspec} = ['*'];
		}
=cut		
		
		


		# If this rel/colname is updatable in the top TableSpec, then that translates
		# into these multi rel rows being addable/deletable
		if ($self->TableSpec->colspec_matches_columns($self->TableSpec->updatable_colspec->colspecs,$colname)){
			$mod_params->{creatable_colspec} = [ @{$RelTS->updatable_colspec->colspecs} ];
			$mod_params->{destroyable_relspec} = ['*'];
			delete $mod_params->{creatable_colspec} unless (@{$mod_params->{creatable_colspec}} > 0);
			
			# We *must* be able to create on the forein col name to be able to create the link/relationship:
			if($mod_params->{creatable_colspec}) {
				push @{$mod_params->{creatable_colspec}}, $cond_data->{foreign};
				push @{$mod_params->{include_colspec}}, $cond_data->{foreign};
				
				# We can't change the key/link field:
				push @{$mod_params->{updatable_colspec}}, '!' . $cond_data->{foreign};
			}
		}

		$mod_params->{ResultSource} = $Source;
	
		$self->apply_init_modules( $mod_name => {
			class 	=> 'RapidApp::DbicAppGrid3',
			params	=> $mod_params
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

#has 'req_Row', is => 'ro', lazy => 1, traits => [ 'RapidApp::Role::PerRequestBuildDefReset' ], default => sub {
sub req_Row {
	my $self = shift;
	return $self->_ResultSet->first;
};

sub call_apply_items_config {
	my $self = shift;
	
	unless ($self->req_Row){
		$self->apply_extconfig(
			tabTitle 	=> 'Record not found',
			tabIconCls 	=> 'icon-cancel'
		);
		return $self->apply_extconfig( items => [{
			html => '<div class="ra-autopanel-error">' .
				'<div class="ra-exception-heading">Record not found</div>' .
				'<div class="msg">Record not found by id: "' . $self->supplied_id . '"</div>' .
			'</div>'
		}]);
	}

	return $self->apply_items_config;
}

sub apply_items_config {
	my $self = shift;
	
	$self->apply_extconfig( items => [ $self->full_property_grid ] );
}

sub multi_grids {
	my $self = shift;
	return $self->full_property_grid(1);
}

sub full_property_grid {
	my $self = shift;
	my $multi_only = shift || 0;
	
	local $ONLY_MULTI_GRIDS = 1 if ($multi_only);
	
	my $real_columns = [];
	my @items = $self->TableSpec_property_grids($self->TableSpec,$self->req_Row,$real_columns);
	shift @items;
	
	# -- for performance, delete all the remaining columns that don't exist for
	# this row (such as relationships that don't exist for this row)
	#my %real_indx = map {$_=>1} @$real_columns;
	#my @delete_columns = grep { !$real_indx{$_} } keys %{$self->columns};
	#$self->delete_columns(@delete_columns);
	# --

	return @items;
}


sub TS_title {
	my $self = shift;
	my $TableSpec = shift;
	my $parm = shift || 'title';
	
	my $title = $TableSpec->relspec_prefix;
	$title = $self->TableSpec->name . '.' . $title unless ($title eq '');
	$title = $self->TableSpec->name if ($title eq '');
	
	my $cnftitle = $TableSpec->get_Cnf($parm);
	$title = $cnftitle . ' (' . $title . ')' unless ($TableSpec->name eq $cnftitle);
	
	return $title;
}



sub TableSpec_property_grids {
	my $self = shift;
	my $TableSpec = shift;
	my $Row = shift || $self->req_Row;
	my $real_columns = shift || [];
	
	return $self->not_found_content unless ($Row);
	
	my %cols = map { $_->{name} => $_ } @{ $self->column_list };
	
	my @colnames = $TableSpec->local_column_names;
	push @$real_columns, @colnames;

=pod
	# -- Filter out non-existant relationship columns:
	@colnames = grep {
		exists $TableSpec->related_TableSpec->{$_} ?
			$Row->can($_) ? $Row->$_ ? 1 : 0 
				: 0
					: 1;
	} @colnames;
	# --
=cut
	
	
	my @columns = map { $cols{$_} } @colnames;
	my $fields = \@columns;
	

	my $icon = $TableSpec->get_Cnf('singleIconCls');
	
	my @items = ();
	my @multi_items = ();
	my $visible = scalar grep { ! jstrue $_->{no_column} } @$fields;
	
	push @items, { xtype => 'spacer', height => 5 }, $self->property_grid($TableSpec,$icon,$fields) 
		if ($visible && ! $ONLY_MULTI_GRIDS);
	
	my @TableSpecs = ();
	
	foreach my $rel (@{$TableSpec->related_TableSpec_order}) {
		
		next if ($self->exclude_grids_relationships_map->{$rel});
		
		# This is fundamentally flawed if a related record doesn't exist initially, but then 
		# gets created, it will never be available!!
		my $relRow = $Row->$rel or next;
		if($relRow->isa('DBIx::Class::Row')) {
			push @items, $self->TableSpec_property_grids(
				$TableSpec->related_TableSpec->{$rel},
				$relRow,
				$real_columns
			);
		}
		elsif($relRow->isa('DBIx::Class::ResultSet') and ($self->setup_multi_grids || $ONLY_MULTI_GRIDS)) {
		
			my $RelTS = $TableSpec->related_TableSpec->{$rel};
			
			my $info = $Row->result_source->relationship_info($rel);
			next unless ($info->{attrs}->{accessor} eq 'multi'); #<-- should be redundant
			my $cond_data = RapidApp::DBIC::Component::TableSpec->parse_relationship_cond($info->{cond});
			
			my $mod_name = 'rel_' . $RelTS->column_prefix . $rel;
			
			my $cur = $self->Module($mod_name)->content;
			push @{$cur->{plugins}}, 'grid-autoheight', 'titlecollapseplus';
			
			push @multi_items, { xtype => 'spacer', height => 5 };
			push @multi_items, {
				%$cur,
				autoWidth		=> \1,
				titleCountLocal => \1,
				collapsible => \1,
				collapseFirst => \1,
				titleCollapse => \1,
				title => $self->TS_title($RelTS,'title_multi'),
				#title => $RelTS->get_Cnf('title_multi') . ' (' . $rel . ')',
				iconCls => $RelTS->get_Cnf('multiIconCls'),
				gridsearch			=> undef,
				pageSize			=> undef,
				use_multifilters	=> \0,
				viewConfig => { emptyText => '<span style="color:darkgrey;">(No&nbsp;' . $RelTS->get_Cnf('title_multi') . ')</span>' },
				# Why do I have to set this manually?
				bodyStyle => 'border: 1px solid #D0D0D0;',
				baseParams => {
					resultset_condition => $self->json->encode({ 'me.' . $cond_data->{foreign} => $Row->get_column($cond_data->{self}) })
				},
				store_add_initData => {
					$cond_data->{foreign} => $Row->get_column($cond_data->{self})
				}
			};
		}
	}
	
	unshift @multi_items, { xtype => 'spacer', height => 5 } if (@multi_items > 0);

	return @items,@multi_items;
}



sub property_grid {
	my $self = shift;
	my $TableSpec = shift;
	my $icon = shift;
	my $fields = shift;
	my $opt = shift || {};
	
	my $title = $self->TS_title($TableSpec);
	
	# -- Programatically remove the automatically appened relspec from the header
	# (Search for 'column_property_transforms' in RapidApp::TableSpec::Role::DBIC for details)
	# We are just doing this so the column headers are shorter/cleaner and it is redundant in
	# this context (same info is in the title of the property grid).
	my $pre = $TableSpec->relspec_prefix;
	foreach my $column (@$fields) {
		$column->{header} or next;
		$column->{header} =~ s/\s+\(${pre}\)$//;
	}
	# --
	
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


